import * as fs from "fs";
import * as path from "path";
import {
  applyPatchesToBody,
  BytePatch,
  classIndexByName,
  disassemble,
  ensureBackup,
  Instruction,
  methodIdxForTrait,
  parseAbc,
  parseSwf,
  PatchError,
  writeSwf,
} from "./swfPatchUtils";

const DEFAULT_SWF = path.resolve(
  __dirname,
  "..",
  "..",
  "client",
  "content",
  "localhost",
  "p",
  "cbp",
  "DungeonBlitz.swf",
);

function parseArgs(argv: string[]): { swfPath: string; verify: boolean } {
  let swfPath = DEFAULT_SWF;
  let verify = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--swf" || arg === "-s") {
      swfPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--verify" || arg === "--dry-run") {
      verify = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  npx tsx src/server/scripts/patch-dungeonblitz-dragon-soul-safe-summon.ts [--verify] [--swf <path>]",
        "",
        "Restores the safe DragonSoulShotN assignment in ActivePower.method_872",
        "for spawned DragonSoul helpers. This prevents the helper from copying",
        "SummonDragonSoul itself during the summon cast.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function getActivePowerMethod872(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "ActivePower");
  if (classIndex === null) {
    throw new PatchError("Could not find ActivePower class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_872");
  if (methodIdx === null) {
    throw new PatchError("Could not find ActivePower.method_872.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for ActivePower.method_872 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  return { ctx, abc, methodBody, code };
}

function multiname(abc: ReturnType<typeof parseAbc>, inst: Instruction): string | null {
  if (inst.operands.length === 0 || inst.operands[0][0] !== "u30") {
    return null;
  }
  return abc.multinameNames[inst.operands[0][1]] ?? null;
}

function stringValue(abc: ReturnType<typeof parseAbc>, inst: Instruction): string | null {
  if (inst.opcode !== 0x2c || inst.operands.length === 0 || inst.operands[0][0] !== "u30") {
    return null;
  }
  return abc.stringValues[inst.operands[0][1]] ?? null;
}

function localOperand(inst: Instruction): number | null {
  if (inst.operands.length === 0 || inst.operands[0][0] !== "u30") {
    return null;
  }
  return inst.operands[0][1];
}

function findDragonSoulShotAssignment(abc: ReturnType<typeof parseAbc>, instructions: Instruction[]): { start: number; end: number } | null {
  for (let index = 0; index <= instructions.length - 8; index += 1) {
    const window = instructions.slice(index, index + 8);
    if (
      window[0].opcode === 0x60 &&
      multiname(abc, window[0]) === "class_14" &&
      window[1].opcode === 0x66 &&
      multiname(abc, window[1]) === "powerTypesDict" &&
      window[2].opcode === 0x2c &&
      stringValue(abc, window[2]) === "DragonSoulShot" &&
      window[3].opcode === 0x62 &&
      localOperand(window[3]) === 33 &&
      window[4].opcode === 0xa0 &&
      window[5].opcode === 0x66 &&
      window[6].opcode === 0x80 &&
      multiname(abc, window[6]) === "PowerType" &&
      window[7].opcode === 0x63 &&
      localOperand(window[7]) === 31
    ) {
      return {
        start: window[0].offset,
        end: window[7].offset + window[7].size,
      };
    }
  }
  return null;
}

function findCopiedPowerAssignment(abc: ReturnType<typeof parseAbc>, instructions: Instruction[]): { start: number } | null {
  for (let index = 0; index <= instructions.length - 3; index += 1) {
    const first = instructions[index];
    const second = instructions[index + 1];
    const third = instructions[index + 2];
    if (
      first?.opcode !== 0xd0 ||
      second?.opcode !== 0x66 ||
      multiname(abc, second) !== "powerType" ||
      third?.opcode !== 0x63 ||
      localOperand(third) !== 31
    ) {
      continue;
    }

    const nextMeaningful = instructions.slice(index + 3, index + 18).find((inst) => inst.opcode !== 0x02);
    if (nextMeaningful?.opcode === 0x62 && localOperand(nextMeaningful) === 30) {
      return { start: first.offset };
    }
  }
  return null;
}

function patchSwf(swfPath: string, verify: boolean): void {
  const backupPath = `${swfPath}.bak`;
  if (!fs.existsSync(backupPath)) {
    throw new PatchError(`${swfPath}: missing ${path.basename(backupPath)} needed to recover the original DragonSoulShot assignment.`);
  }

  const current = getActivePowerMethod872(swfPath);
  const currentInstructions = disassemble(current.code, "ActivePower.method_872");
  if (findDragonSoulShotAssignment(current.abc, currentInstructions)) {
    console.log(`${swfPath}: already patched (DragonSoul summon uses DragonSoulShotN).`);
    return;
  }

  const copiedAssignment = findCopiedPowerAssignment(current.abc, currentInstructions);
  if (!copiedAssignment) {
    throw new PatchError(`${swfPath}: could not find copied power assignment in ActivePower.method_872.`);
  }

  const backup = getActivePowerMethod872(backupPath);
  const backupInstructions = disassemble(backup.code, "ActivePower.method_872");
  const originalAssignment = findDragonSoulShotAssignment(backup.abc, backupInstructions);
  if (!originalAssignment) {
    throw new PatchError(`${backupPath}: could not find original DragonSoulShotN assignment.`);
  }

  const originalBytes = backup.code.subarray(originalAssignment.start, originalAssignment.end);
  const currentEnd = copiedAssignment.start + originalBytes.length;
  if (currentEnd > current.code.length) {
    throw new PatchError(`${swfPath}: recovered DragonSoulShot assignment does not fit current method body.`);
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; DragonSoul summon still copies the triggering power.`);
  }

  const patches: BytePatch[] = [
    {
      key: "ActivePower.method_872.dragonSoulSafeSummon",
      start: current.methodBody.codeStart + copiedAssignment.start,
      end: current.methodBody.codeStart + currentEnd,
      data: Buffer.from(originalBytes),
      detail: "restore DragonSoulShotN assignment for DragonSoul summon",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(current.ctx.body, patches);
  writeSwf(current.ctx, body, delta);
  console.log(`${swfPath}: patched DragonSoul summon to use DragonSoulShotN.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
