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
  u30OperandName,
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
const FLOAT_TEXT_SAFE_PIXELS = 262144;
const FALLBACK_BITMAP_SIZE = 128;

type Operand = [Instruction["operands"][number][0], number];
type InsertedInstruction =
  | { label: string }
  | { opcode: number; operands?: Operand[]; branchTo?: string };

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
        "  ts-node src/server/scripts/patch-dungeonblitz-class72-floattext-bitmapdata-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches class_72.method_1943 so oversized floating combat text",
        "BitmapData allocations use a safe fallback instead of crashing Flash.",
      ].join("\n"));
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function writeS24(value: number): Buffer {
  const out = Buffer.alloc(3);
  let encoded = value;
  if (encoded < 0) {
    encoded += 1 << 24;
  }
  out[0] = encoded & 0xff;
  out[1] = (encoded >>> 8) & 0xff;
  out[2] = (encoded >>> 16) & 0xff;
  return out;
}

function operandBytes(kind: Operand[0], value: number): Buffer {
  if (kind === "u30") {
    return writeU30(value);
  }
  if (kind === "s8") {
    return Buffer.from([value & 0xff]);
  }
  if (kind === "s24") {
    return writeS24(value);
  }
  throw new PatchError(`Unsupported operand kind ${kind}`);
}

function assembleInserted(instructions: InsertedInstruction[]): Buffer {
  const labels = new Map<string, number>();
  let offset = 0;
  for (const inst of instructions) {
    if ("label" in inst) {
      labels.set(inst.label, offset);
      continue;
    }
    offset += 1;
    if (inst.branchTo) {
      offset += 3;
    } else {
      for (const [kind, value] of inst.operands ?? []) {
        offset += operandBytes(kind, value).length;
      }
    }
  }

  const chunks: Buffer[] = [];
  const fixups: Array<{ pos: number; target: string }> = [];
  offset = 0;
  for (const inst of instructions) {
    if ("label" in inst) {
      continue;
    }
    const parts: Buffer[] = [Buffer.from([inst.opcode])];
    offset += 1;
    if (inst.branchTo) {
      parts.push(Buffer.alloc(3));
      fixups.push({ pos: offset, target: inst.branchTo });
      offset += 3;
    } else {
      for (const [kind, value] of inst.operands ?? []) {
        const bytes = operandBytes(kind, value);
        parts.push(bytes);
        offset += bytes.length;
      }
    }
    chunks.push(Buffer.concat(parts));
  }

  const assembled = Buffer.concat(chunks);
  for (const fixup of fixups) {
    const target = labels.get(fixup.target);
    if (target === undefined) {
      throw new PatchError(`Unknown branch label ${fixup.target}`);
    }
    writeS24(target - (fixup.pos + 3)).copy(assembled, fixup.pos);
  }
  return assembled;
}

function isBranchOpcode(opcode: number): boolean {
  return opcode >= 0x0c && opcode <= 0x1a;
}

function applyCodeEditsAndAdjustBranches(
  originalCode: Buffer,
  instructions: Instruction[],
  edits: Array<{ start: number; end: number; data: Buffer }>,
): Buffer {
  const ordered = [...edits].sort((left, right) => left.start - right.start);
  const chunks: Buffer[] = [];
  let cursor = 0;
  for (const edit of ordered) {
    chunks.push(originalCode.subarray(cursor, edit.start));
    chunks.push(edit.data);
    cursor = edit.end;
  }
  chunks.push(originalCode.subarray(cursor));
  const patched = Buffer.concat(chunks);

  function deltaFor(edit: { start: number; end: number; data: Buffer }): number {
    return edit.data.length - (edit.end - edit.start);
  }

  function isInsideEdit(offset: number): boolean {
    return ordered.some((edit) => offset >= edit.start && offset < edit.end);
  }

  function mapInstructionOffset(offset: number): number {
    let mapped = offset;
    for (const edit of ordered) {
      if (edit.end <= offset || (edit.start === edit.end && edit.start <= offset)) {
        mapped += deltaFor(edit);
      }
    }
    return mapped;
  }

  function mapTargetOffset(offset: number): number {
    let mapped = offset;
    for (const edit of ordered) {
      if (offset < edit.start) {
        continue;
      }
      if (offset >= edit.start && offset < edit.end) {
        return edit.start + (mapped - offset);
      }
      if (offset === edit.end) {
        return edit.start + edit.data.length + (mapped - offset);
      }
      mapped += deltaFor(edit);
    }
    return mapped;
  }

  for (const inst of instructions) {
    if (!isBranchOpcode(inst.opcode) || isInsideEdit(inst.offset)) {
      continue;
    }
    const branch = inst.operands[0];
    if (branch?.[0] !== "s24") {
      throw new PatchError(`Unexpected branch operand at original offset ${inst.offset}`);
    }
    const oldEnd = inst.offset + inst.size;
    const oldTarget = oldEnd + branch[1];
    const newInstOffset = mapInstructionOffset(inst.offset);
    const newEnd = newInstOffset + inst.size;
    const newTarget = mapTargetOffset(oldTarget);
    writeS24(newTarget - newEnd).copy(patched, newInstOffset + 1);
  }

  return patched;
}

function getLocal(localIndex: number): InsertedInstruction {
  if (localIndex >= 0 && localIndex <= 3) {
    return { opcode: 0xd0 + localIndex };
  }
  return { opcode: 0x62, operands: [["u30", localIndex]] };
}

function setLocal(localIndex: number): InsertedInstruction {
  if (localIndex >= 0 && localIndex <= 3) {
    return { opcode: 0xd4 + localIndex };
  }
  return { opcode: 0x63, operands: [["u30", localIndex]] };
}

function pushInteger(value: number): InsertedInstruction {
  if (value >= -128 && value <= 127) {
    return { opcode: 0x24, operands: [["s8", value]] };
  }
  return { opcode: 0x25, operands: [["u30", value]] };
}

function getPropertyName(inst: Instruction | undefined, abc: ReturnType<typeof parseAbc>, expected: string): number {
  if (!inst || inst.opcode !== 0x66 || u30OperandName(inst, abc.multinameNames) !== expected) {
    throw new PatchError(`Expected getproperty ${expected}`);
  }
  const operand = inst.operands[0];
  if (operand?.[0] !== "u30") {
    throw new PatchError(`Unexpected getproperty operand for ${expected}`);
  }
  return operand[1];
}

function findVar1344Name(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): number {
  for (const inst of instructions) {
    if ((inst.opcode === 0x68 || inst.opcode === 0x61) && u30OperandName(inst, abc.multinameNames) === "var_1344") {
      const operand = inst.operands[0];
      if (operand?.[0] === "u30") {
        return operand[1];
      }
    }
  }
  throw new PatchError("Could not find class_72.var_1344 property name.");
}

function findBitmapDataName(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): number {
  for (const inst of instructions) {
    if (inst.opcode === 0x5d && u30OperandName(inst, abc.multinameNames) === "BitmapData") {
      const operand = inst.operands[0];
      if (operand?.[0] === "u30") {
        return operand[1];
      }
    }
  }
  throw new PatchError("Could not find BitmapData multiname.");
}

function findAllocationRange(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): {
  start: number;
  end: number;
  widthName: number;
  heightName: number;
  bitmapDataName: number;
} {
  for (let index = 0; index < instructions.length - 11; index += 1) {
    const find = instructions[index];
    const widthTarget = instructions[index + 1];
    const width = instructions[index + 2];
    const paddingWidth = instructions[index + 3];
    const addWidth = instructions[index + 4];
    const heightTarget = instructions[index + 5];
    const height = instructions[index + 6];
    const paddingHeight = instructions[index + 7];
    const addHeight = instructions[index + 8];
    const pushTrue = instructions[index + 9];
    const pushZero = instructions[index + 10];
    const construct = instructions[index + 11];
    if (
      find.opcode === 0x5d &&
      u30OperandName(find, abc.multinameNames) === "BitmapData" &&
      widthTarget.opcode === 0x62 &&
      widthTarget.operands[0]?.[1] === 7 &&
      paddingWidth.opcode === 0x62 &&
      paddingWidth.operands[0]?.[1] === 10 &&
      addWidth.opcode === 0xa0 &&
      heightTarget.opcode === 0x62 &&
      heightTarget.operands[0]?.[1] === 7 &&
      paddingHeight.opcode === 0x62 &&
      paddingHeight.operands[0]?.[1] === 10 &&
      addHeight.opcode === 0xa0 &&
      pushTrue.opcode === 0x26 &&
      pushZero.opcode === 0x24 &&
      pushZero.operands[0]?.[1] === 0 &&
      construct.opcode === 0x4a &&
      u30OperandName(construct, abc.multinameNames) === "BitmapData" &&
      construct.operands[1]?.[1] === 4
    ) {
      return {
        start: find.offset,
        end: construct.offset + construct.size,
        widthName: getPropertyName(width, abc, "width"),
        heightName: getPropertyName(height, abc, "height"),
        bitmapDataName: find.operands[0][1],
      };
    }
  }
  throw new PatchError("Could not find class_72.method_1943 BitmapData allocation.");
}

function buildGuard(range: ReturnType<typeof findAllocationRange>, var1344Name: number): Buffer {
  return assembleInserted([
    getLocal(7),
    { opcode: 0x66, operands: [["u30", range.widthName]] },
    getLocal(10),
    { opcode: 0xa0 },
    { opcode: 0x73 },
    setLocal(14),
    getLocal(7),
    { opcode: 0x66, operands: [["u30", range.heightName]] },
    getLocal(10),
    { opcode: 0xa0 },
    { opcode: 0x73 },
    setLocal(15),
    getLocal(14),
    pushInteger(1),
    { opcode: 0xae },
    { opcode: 0x11, branchTo: "invalid" },
    getLocal(15),
    pushInteger(1),
    { opcode: 0xae },
    { opcode: 0x11, branchTo: "invalid" },
    getLocal(14),
    pushInteger(8191),
    { opcode: 0xaf },
    { opcode: 0x11, branchTo: "invalid" },
    getLocal(15),
    pushInteger(8191),
    { opcode: 0xaf },
    { opcode: 0x11, branchTo: "invalid" },
    getLocal(14),
    getLocal(15),
    { opcode: 0xa2 },
    pushInteger(FLOAT_TEXT_SAFE_PIXELS),
    { opcode: 0xaf },
    { opcode: 0x12, branchTo: "ok" },
    { label: "invalid" },
    getLocal(0),
    { opcode: 0x26 },
    { opcode: 0x68, operands: [["u30", var1344Name]] },
    pushInteger(FALLBACK_BITMAP_SIZE),
    setLocal(14),
    pushInteger(FALLBACK_BITMAP_SIZE),
    setLocal(15),
    { label: "ok" },
    { opcode: 0x5d, operands: [["u30", range.bitmapDataName]] },
    getLocal(14),
    getLocal(15),
    { opcode: 0x26 },
    pushInteger(0),
    { opcode: 0x4a, operands: [["u30", range.bitmapDataName], ["u30", 4]] },
  ]);
}

function getInstanceMethod(swfPath: string, className: string, methodName: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, className);
  if (classIndex === null) {
    throw new PatchError(`Could not find ${className} class.`);
  }
  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, methodName);
  if (methodIdx === null) {
    throw new PatchError(`Could not find ${className}.${methodName}.`);
  }
  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for ${className}.${methodName}.`);
  }
  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `${className}.${methodName}:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function hasGuard(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): boolean {
  return instructions.some((inst, index) =>
    inst.opcode === 0x25 &&
    inst.operands[0]?.[1] === FLOAT_TEXT_SAFE_PIXELS &&
    instructions.slice(index, index + 20).some((candidate) => candidate.opcode === 0x68 && u30OperandName(candidate, abc.multinameNames) === "var_1344")
  );
}

function writePatchedMethod(
  swfPath: string,
  ctx: ReturnType<typeof parseSwf>,
  methodBody: ReturnType<typeof getInstanceMethod>["methodBody"],
  patchedCode: Buffer,
): void {
  const patches: BytePatch[] = [
    {
      key: "class_72.method_1943.localCount",
      start: methodBody.localCountPos,
      end: methodBody.localCountPos + 1,
      data: writeU30(16),
      detail: "increase local count for float text BitmapData guard",
    },
    {
      key: "class_72.method_1943.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "insert float text BitmapData dimension guard",
    },
    {
      key: "class_72.method_1943.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update method_1943 code length",
    },
  ];
  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getInstanceMethod(swfPath, "class_72", "method_1943");
  if (hasGuard(instructions, abc)) {
    console.log(`${swfPath}: already patched (class_72.method_1943 BitmapData guard present).`);
    return;
  }
  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; class_72.method_1943 BitmapData guard is missing.`);
  }
  const range = findAllocationRange(instructions, abc);
  const var1344Name = findVar1344Name(instructions, abc);
  const guard = buildGuard(range, var1344Name);
  const patchedCode = applyCodeEditsAndAdjustBranches(code, instructions, [
    { start: range.start, end: range.end, data: guard },
  ]);
  writePatchedMethod(swfPath, ctx, methodBody, patchedCode);
  console.log(`${swfPath}: patched class_72.method_1943 BitmapData guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
