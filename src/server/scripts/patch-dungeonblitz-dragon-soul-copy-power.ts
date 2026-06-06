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
  writeU30,
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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-dragon-soul-copy-power.ts [--verify] [--swf <path>]",
        "",
        "Patches ActivePower.method_872 so Dragon Soul copies the triggering",
        "power instead of always replacing it with DragonSoulShotN.",
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

function buildCopyPowerAssignment(abc: ReturnType<typeof parseAbc>, originalLength: number): Buffer {
  const powerTypeName = abc.multinameNames.findIndex((candidate) => candidate === "powerType");
  if (powerTypeName < 0) {
    throw new PatchError("Could not find powerType multiname.");
  }

  const assignment = Buffer.concat([
    Buffer.from([0xd0, 0x66]),
    writeU30(powerTypeName),
    Buffer.from([0x63]),
    writeU30(31),
  ]);
  if (assignment.length > originalLength) {
    throw new PatchError(`Dragon Soul copy-power assignment grew from ${originalLength} to ${assignment.length} bytes.`);
  }
  return Buffer.concat([assignment, Buffer.alloc(originalLength - assignment.length, 0x02)]);
}

function isCopyPowerAssignment(abc: ReturnType<typeof parseAbc>, instructions: Instruction[], index: number): boolean {
  const first = instructions[index];
  const second = instructions[index + 1];
  const third = instructions[index + 2];
  return Boolean(
    first?.opcode === 0xd0 &&
      second?.opcode === 0x66 &&
      multiname(abc, second) === "powerType" &&
      third?.opcode === 0x63 &&
      localOperand(third) === 31,
  );
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

function hasCopyPowerPatch(abc: ReturnType<typeof parseAbc>, instructions: Instruction[]): boolean {
  for (let index = 0; index <= instructions.length - 3; index += 1) {
    if (!isCopyPowerAssignment(abc, instructions, index)) {
      continue;
    }
    const nextMeaningful = instructions.slice(index + 3, index + 18).find((inst) => inst.opcode !== 0x02);
    if (nextMeaningful?.opcode === 0x62 && localOperand(nextMeaningful) === 30) {
      return true;
    }
  }
  return false;
}

export function hasDragonSoulCopyPowerPatch(swfPath: string): boolean {
  const { abc, code } = getActivePowerMethod872(swfPath);
  const instructions = disassemble(code, "ActivePower.method_872");
  return hasCopyPowerPatch(abc, instructions);
}

export function patchDragonSoulCopyPower(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code } = getActivePowerMethod872(swfPath);
  const instructions = disassemble(code, "ActivePower.method_872");
  if (hasCopyPowerPatch(abc, instructions)) {
    console.log(`${swfPath}: already patched (Dragon Soul copies triggering power).`);
    return;
  }

  const originalRange = findDragonSoulShotAssignment(abc, instructions);
  if (!originalRange) {
    throw new PatchError(`${swfPath}: could not find DragonSoulShotN assignment in ActivePower.method_872.`);
  }
  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Dragon Soul still replaces copied powers with DragonSoulShotN.`);
  }

  const originalLength = originalRange.end - originalRange.start;
  const patches: BytePatch[] = [
    {
      key: "ActivePower.method_872.dragonSoulCopyPower",
      start: methodBody.codeStart + originalRange.start,
      end: methodBody.codeStart + originalRange.end,
      data: buildCopyPowerAssignment(abc, originalLength),
      detail: "make Dragon Soul use the triggering power",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Dragon Soul copy-power behavior.`);
}

if (require.main === module) {
  const { swfPath, verify } = parseArgs(process.argv);
  patchDragonSoulCopyPower(swfPath, verify);
}
