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

type Operand = [Instruction["operands"][number][0], number];
type InsertedInstruction =
  | { label: string }
  | { opcode: number; operands?: Operand[]; branchTo?: string };

type Args = {
  swfPath: string;
  outputPath: string;
  verify: boolean;
};

function parseArgs(argv: string[]): Args {
  let swfPath = DEFAULT_SWF;
  let outputPath = "";
  let verify = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--swf" || arg === "-s") {
      swfPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      outputPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--verify" || arg === "--dry-run") {
      verify = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-room-clear-block.ts [--verify] [--swf <path>] [--output <path>]",
        "",
        "Patches Room.method_695, Room.method_1969, and Room.method_1872",
        "so scripted double-boss fights do not mark or clean the room before bosses die.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, outputPath: outputPath || swfPath, verify };
}

function writeS24(value: number): Buffer {
  if (value < -0x800000 || value > 0x7fffff) {
    throw new PatchError(`s24 branch offset out of range: ${value}`);
  }
  const encoded = value < 0 ? value + 0x1000000 : value;
  return Buffer.from([encoded & 0xff, (encoded >> 8) & 0xff, (encoded >> 16) & 0xff]);
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

function getRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((value) => value === name);
  if (index <= 0) {
    throw new PatchError(`Missing multiname: ${name}`);
  }
  return index;
}

function buildRoomClearBlockPrefix(abc: ReturnType<typeof parseAbc>): Buffer {
  const var122 = getRequiredMultiname(abc, "var_122");
  const bDoubleBossFight = getRequiredMultiname(abc, "bDoubleBossFight");

  return assembleInserted([
    { opcode: 0xd0 }, // getlocal0
    { opcode: 0x66, operands: [["u30", var122]] }, // getproperty var_122
    { opcode: 0x12, branchTo: "original" }, // iffalse original
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", var122]] },
    { opcode: 0x66, operands: [["u30", bDoubleBossFight]] },
    { opcode: 0x12, branchTo: "original" }, // iffalse original
    { opcode: 0x47 }, // returnvoid
    { label: "original" },
  ]);
}

function roomClearBlockPrefixEnd(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): number | null {
  const names = abc.multinameNames;
  const hasShortPrefixShape =
    instructions[0]?.opcode === 0xd0 &&
    instructions[1]?.opcode === 0x66 &&
    u30OperandName(instructions[1], names) === "var_122" &&
    instructions[2]?.opcode === 0x12 &&
    instructions[3]?.opcode === 0xd0 &&
    instructions[4]?.opcode === 0x66 &&
    u30OperandName(instructions[4], names) === "var_122" &&
    instructions[5]?.opcode === 0x66 &&
    u30OperandName(instructions[5], names) === "bDoubleBossFight" &&
    instructions[6]?.opcode === 0x12 &&
    instructions[7]?.opcode === 0x47;

  if (hasShortPrefixShape) {
    return instructions[7].offset + instructions[7].size;
  }

  const hasOldActivePhasePrefixShape =
    instructions[0]?.opcode === 0xd0 &&
    instructions[1]?.opcode === 0x66 &&
    u30OperandName(instructions[1], names) === "var_122" &&
    instructions[2]?.opcode === 0x12 &&
    instructions[3]?.opcode === 0xd0 &&
    instructions[4]?.opcode === 0x66 &&
    u30OperandName(instructions[4], names) === "var_122" &&
    instructions[5]?.opcode === 0x66 &&
    u30OperandName(instructions[5], names) === "bDoubleBossFight" &&
    instructions[6]?.opcode === 0x12 &&
    instructions[7]?.opcode === 0xd0 &&
    instructions[8]?.opcode === 0x66 &&
    (u30OperandName(instructions[8], names) === "var_1978" || u30OperandName(instructions[8], names) === "var_1672") &&
    instructions[9]?.opcode === 0x20 &&
    instructions[10]?.opcode === 0xab &&
    instructions[11]?.opcode === 0x11 &&
    instructions[12]?.opcode === 0x47;

  return hasOldActivePhasePrefixShape ? instructions[12].offset + instructions[12].size : null;
}

function hasCurrentRoomClearBlockPrefix(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): boolean {
  const names = abc.multinameNames;
  const prefixEnd = roomClearBlockPrefixEnd(instructions, abc);
  return prefixEnd !== null && instructions[7]?.opcode === 0x47 && u30OperandName(instructions[5], names) === "bDoubleBossFight";
}

function analyzeMethodPatch(
  ctx: ReturnType<typeof parseSwf>,
  abc: ReturnType<typeof parseAbc>,
  classIndex: number,
  methodName: string,
): BytePatch[] {
  const resolvedMethodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, methodName);
  if (resolvedMethodIdx === null) {
    throw new PatchError(`Room.${methodName} not found`);
  }
  const methodBody = abc.methodBodies.get(resolvedMethodIdx);
  if (!methodBody) {
    throw new PatchError(`Room.${methodName} body not found`);
  }
  if (methodBody.exceptionCount !== 0) {
    throw new PatchError(`Room.${methodName} has exception ranges; refusing to insert without exception remapping`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Room.${methodName}`);
  if (hasCurrentRoomClearBlockPrefix(instructions, abc)) {
    return [];
  }

  const previousPrefixEnd = roomClearBlockPrefixEnd(instructions, abc) ?? 0;
  const prefix = buildRoomClearBlockPrefix(abc);
  const newCode = Buffer.concat([prefix, code.subarray(previousPrefixEnd)]);
  return [
    {
      key: `room-${methodName}-clear-block-code-length`,
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(newCode.length),
      detail: `Room.${methodName} code_length ${methodBody.codeLen} -> ${newCode.length}`,
    },
    {
      key: `room-${methodName}-clear-block-code`,
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: newCode,
      detail: `Skip Room.${methodName} while a scripted double-boss fight is active`,
    },
  ];
}

function analyzePatch(swfPath: string): { ctx: ReturnType<typeof parseSwf>; patches: BytePatch[] } {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Room");
  if (classIndex === null) {
    throw new PatchError("Room class not found");
  }

  const patches = [
    ...analyzeMethodPatch(ctx, abc, classIndex, "method_695"),
    ...analyzeMethodPatch(ctx, abc, classIndex, "method_1969"),
    ...analyzeMethodPatch(ctx, abc, classIndex, "method_1872"),
  ];
  return { ctx, patches };
}

function main(): number {
  const args = parseArgs(process.argv);
  const { ctx, patches } = analyzePatch(args.swfPath);
  console.log(`SWF: ${args.swfPath}`);

  if (patches.length === 0) {
    console.log("No changes needed.");
    return 0;
  }

  for (const patch of patches) {
    console.log(`Patch: ${patch.detail}`);
  }
  if (args.verify) {
    return 0;
  }

  if (path.resolve(args.outputPath) === path.resolve(args.swfPath)) {
    ensureBackup(args.swfPath);
  }
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  ctx.path = args.outputPath;
  writeSwf(ctx, body, delta);
  console.log(`Patched SWF written to ${args.outputPath}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
