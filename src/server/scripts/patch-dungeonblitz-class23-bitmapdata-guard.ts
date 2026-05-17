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
const CLASS23_SAFE_TOTAL_PIXELS = 16777215;
const CLASS23_FALLBACK_BITMAP_SIZE = 512;

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-class23-bitmapdata-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches class_23.method_942 so oversized render-cache BitmapData",
        "allocations fall back to a safe 512x512 bitmap instead of crashing Flash.",
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

function isBranchOpcode(opcode: number): boolean {
  return opcode >= 0x0c && opcode <= 0x1a;
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
      if (edit.end <= offset || edit.start === edit.end && edit.start <= offset) {
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

function pushInteger(value: number): InsertedInstruction {
  if (value >= -128 && value <= 127) {
    return { opcode: 0x24, operands: [["s8", value]] };
  }
  return { opcode: 0x25, operands: [["u30", value]] };
}

function getInstanceProperty(nameIndex: number): InsertedInstruction[] {
  return [
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", nameIndex]] },
  ];
}

function setInstanceProperty(nameIndex: number, value: number): InsertedInstruction[] {
  return [
    { opcode: 0xd0 },
    pushInteger(value),
    { opcode: 0x68, operands: [["u30", nameIndex]] },
  ];
}

function dimensionGuard(widthName: number, heightName: number, totalPixelsIntIndex: number): InsertedInstruction[] {
  return [
    ...getInstanceProperty(widthName),
    ...getInstanceProperty(widthName),
    { opcode: 0xab },
    { opcode: 0x12, branchTo: "invalid" },
    ...getInstanceProperty(heightName),
    ...getInstanceProperty(heightName),
    { opcode: 0xab },
    { opcode: 0x12, branchTo: "invalid" },
    ...getInstanceProperty(widthName),
    pushInteger(1),
    { opcode: 0xad },
    { opcode: 0x11, branchTo: "invalid" },
    ...getInstanceProperty(heightName),
    pushInteger(1),
    { opcode: 0xad },
    { opcode: 0x11, branchTo: "invalid" },
    ...getInstanceProperty(widthName),
    pushInteger(8191),
    { opcode: 0xaf },
    { opcode: 0x11, branchTo: "invalid" },
    ...getInstanceProperty(heightName),
    pushInteger(8191),
    { opcode: 0xaf },
    { opcode: 0x11, branchTo: "invalid" },
    ...getInstanceProperty(widthName),
    ...getInstanceProperty(heightName),
    { opcode: 0xa2 },
    { opcode: 0x2d, operands: [["u30", totalPixelsIntIndex]] },
    { opcode: 0xaf },
    { opcode: 0x11, branchTo: "invalid" },
    { opcode: 0x10, branchTo: "ok" },
    { label: "invalid" },
    ...setInstanceProperty(widthName, CLASS23_FALLBACK_BITMAP_SIZE),
    ...setInstanceProperty(heightName, CLASS23_FALLBACK_BITMAP_SIZE),
    { label: "ok" },
  ];
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found`);
  }
  return index;
}

function findRequiredInt(abc: ReturnType<typeof parseAbc>, value: number): number {
  const index = abc.intValues.findIndex((candidate) => candidate === value);
  if (index < 0) {
    throw new PatchError(`Int constant ${value} not found`);
  }
  return index;
}

function findBitmapDataConstructor(
  instructions: Instruction[],
  abc: ReturnType<typeof parseAbc>,
  widthName: number,
  heightName: number,
): Instruction {
  for (let index = 0; index < instructions.length - 6; index += 1) {
    const inst = instructions[index];
    const widthSelf = instructions[index + 1];
    const width = instructions[index + 2];
    const heightSelf = instructions[index + 3];
    const height = instructions[index + 4];
    const pushTrue = instructions[index + 5];
    const construct = instructions[index + 6];

    if (
      inst.opcode === 0x5d &&
      u30OperandName(inst, abc.multinameNames) === "BitmapData" &&
      widthSelf.opcode === 0xd0 &&
      width.opcode === 0x66 &&
      width.operands[0]?.[1] === widthName &&
      heightSelf.opcode === 0xd0 &&
      height.opcode === 0x66 &&
      height.operands[0]?.[1] === heightName &&
      pushTrue.opcode === 0x26 &&
      construct.opcode === 0x4a &&
      u30OperandName(construct, abc.multinameNames) === "BitmapData" &&
      construct.operands[1]?.[1] === 3
    ) {
      return inst;
    }
  }

  throw new PatchError("Could not find class_23.method_942 BitmapData constructor.");
}

function hasExactGuardBefore(code: Buffer, constructorOffset: number, guard: Buffer): boolean {
  return constructorOffset >= guard.length && code.subarray(constructorOffset - guard.length, constructorOffset).equals(guard);
}

function getClass23Method942(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "class_23");
  if (classIndex === null) {
    throw new PatchError("Could not find class_23 class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_942");
  if (methodIdx === null) {
    throw new PatchError("Could not find class_23.method_942.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for class_23.method_942 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `class_23.method_942:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function writePatchedMethod(
  swfPath: string,
  ctx: ReturnType<typeof parseSwf>,
  methodBody: ReturnType<typeof getClass23Method942>["methodBody"],
  patchedCode: Buffer,
): void {
  const patches: BytePatch[] = [
    {
      key: "class_23.method_942.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "insert BitmapData dimension guard",
    },
    {
      key: "class_23.method_942.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update method_942 code length",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getClass23Method942(swfPath);
  const widthName = findRequiredMultiname(abc, "var_1707");
  const heightName = findRequiredMultiname(abc, "var_2152");
  const totalPixelsIntIndex = findRequiredInt(abc, CLASS23_SAFE_TOTAL_PIXELS);
  const constructor = findBitmapDataConstructor(instructions, abc, widthName, heightName);
  const guard = assembleInserted(dimensionGuard(widthName, heightName, totalPixelsIntIndex));

  if (hasExactGuardBefore(code, constructor.offset, guard)) {
    console.log(`${swfPath}: already patched (class_23.method_942 BitmapData guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; class_23.method_942 BitmapData guard is missing.`);
  }

  const patchedCode = applyCodeEditsAndAdjustBranches(code, instructions, [
    { start: constructor.offset, end: constructor.offset, data: guard },
  ]);
  writePatchedMethod(swfPath, ctx, methodBody, patchedCode);
  console.log(`${swfPath}: patched class_23.method_942 BitmapData guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
