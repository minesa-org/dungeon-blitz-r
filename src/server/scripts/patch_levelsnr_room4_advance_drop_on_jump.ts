import * as path from "path";
import {
  applyPatchesToBody,
  BytePatch,
  classIndexByName,
  defaultLevelsNrPath,
  disassemble,
  ensureBackup,
  methodIdxForTrait,
  parseAbc,
  parseSwf,
  PatchError,
  u30OperandName,
  writeSwf,
  writeU30,
} from "./swfPatchUtils";

const CLASS_NAME = "a_Room_Tutorial_04";
const METHOD_NAME = "WaitingForJump";
const ORIGINAL_TRIGGER = "am_Trigger_Fall2";
const FALL_TRIGGER_INDEX = 1471;
const ATTIME_NAME_INDEX = 25;
const ATTIME_DELAY_MS = 1200;

function resolveSwfPath(args: string[]): string {
  const idx = args.indexOf("--swf-path");
  if (idx !== -1 && idx + 1 < args.length) {
    return path.resolve(args[idx + 1]);
  }
  return defaultLevelsNrPath();
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function buildPushShort(value: number): Buffer {
  return Buffer.concat([Buffer.from([0x25]), writeU30(value)]);
}

function buildCallPropVoid(nameIndex: number, argCount: number): Buffer {
  return Buffer.concat([Buffer.from([0x46]), writeU30(nameIndex), writeU30(argCount)]);
}

function analyzePatch(swfPath: string): {
  ctx: ReturnType<typeof parseSwf>;
  patches: BytePatch[];
} {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, CLASS_NAME);
  if (classIndex === null) {
    throw new PatchError(`${CLASS_NAME} class not found`);
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, METHOD_NAME);
  if (methodIdx === null) {
    throw new PatchError(`${CLASS_NAME}.${METHOD_NAME} not found`);
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`${CLASS_NAME}.${METHOD_NAME} body not found`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instrs = disassemble(code, `${CLASS_NAME}.${METHOD_NAME}`);
  const patches: BytePatch[] = [];
  let triggerChecksSeen = 0;
  let timerPatched = false;
  let sawTimedTransition = false;

  for (let i = 0; i + 1 < instrs.length; i += 1) {
    const inst = instrs[i];
    const next = instrs[i + 1];
    if (next.opcode !== 0x46) {
      continue;
    }

    const triggerName = u30OperandName(inst, abc.stringValues) || "";
    const callName = u30OperandName(next, abc.multinameNames) || "";
    if (inst.opcode === 0x25 && callName === "AtTime") {
      sawTimedTransition = true;
      timerPatched = true;
      continue;
    }
    if (callName !== "OnTrigger") {
      continue;
    }
    if (triggerName !== ORIGINAL_TRIGGER && triggerName !== "am_Trigger_3") {
      continue;
    }

    triggerChecksSeen += 1;
    const instStart = methodBody.codeStart + inst.offset;
    const instEnd = methodBody.codeStart + inst.offset + inst.size;
    const callStart = methodBody.codeStart + next.offset;
    const callEnd = methodBody.codeStart + next.offset + next.size;

    if (triggerChecksSeen === 1) {
      const replacement = Buffer.concat([Buffer.from([0x2c]), writeU30(FALL_TRIGGER_INDEX)]);
      const current = ctx.body.subarray(instStart, instEnd);
      if (!current.equals(replacement)) {
        if (current.length !== replacement.length) {
          throw new PatchError(`Unexpected first trigger width ${current.length}`);
        }
        patches.push({
          key: "levelsnr_room4_restore_first_fall_trigger",
          start: instStart,
          end: instEnd,
          data: replacement,
          detail: `Restore first ${METHOD_NAME} trigger check to ${ORIGINAL_TRIGGER}`,
        });
      }
      continue;
    }

    if (triggerChecksSeen === 2) {
      const pushTimer = buildPushShort(ATTIME_DELAY_MS);
      const callAtTime = buildCallPropVoid(ATTIME_NAME_INDEX, 1);
      const currentInst = ctx.body.subarray(instStart, instEnd);
      const currentCall = ctx.body.subarray(callStart, callEnd);
      if (currentInst.equals(pushTimer) && currentCall.equals(callAtTime)) {
        timerPatched = true;
        continue;
      }
      if (currentInst.length !== pushTimer.length) {
        throw new PatchError(`Unexpected timer push width ${currentInst.length}`);
      }
      if (currentCall.length !== callAtTime.length) {
        throw new PatchError(`Unexpected AtTime call width ${currentCall.length}`);
      }
      patches.push({
        key: "levelsnr_room4_advance_drop_after_jump_prompt_push",
        start: instStart,
        end: instEnd,
        data: pushTimer,
        detail: `Advance ${METHOD_NAME} into a timed transition after ${ATTIME_DELAY_MS}ms`,
      });
      patches.push({
        key: "levelsnr_room4_advance_drop_after_jump_prompt_call",
        start: callStart,
        end: callEnd,
        data: callAtTime,
        detail: `Use AtTime(${ATTIME_DELAY_MS}) instead of OnTrigger for the ${METHOD_NAME} transition`,
      });
      timerPatched = true;
      continue;
    }
  }

  if (triggerChecksSeen === 1 && sawTimedTransition) {
    return { ctx, patches };
  }
  if (triggerChecksSeen < 2 && !timerPatched) {
    throw new PatchError(`Expected at least 2 ${METHOD_NAME} trigger checks, found ${triggerChecksSeen}`);
  }

  return { ctx, patches };
}

function main(): number {
  const args = process.argv.slice(2);
  const swfPath = resolveSwfPath(args);
  const verifyOnly = hasFlag(args, "--verify") || hasFlag(args, "--dry-run");

  try {
    const { ctx, patches } = analyzePatch(swfPath);
    console.log(`SWF: ${swfPath}`);
    if (patches.length === 0) {
      console.log("No changes needed.");
      return 0;
    }

    for (const patch of patches) {
      console.log(`Patch: ${patch.detail}`);
    }
    if (verifyOnly) {
      return 0;
    }

    ensureBackup(swfPath);
    const { body, delta } = applyPatchesToBody(ctx.body, patches);
    writeSwf(ctx, body, delta);
    console.log("Patch apply complete.");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Patch error: ${message}`);
    return 1;
  }
}

process.exit(main());
