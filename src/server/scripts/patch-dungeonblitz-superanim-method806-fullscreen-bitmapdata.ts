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
  u30OperandName,
  writeSwf,
  writeU30,
} from "./swfPatchUtils";

const DEFAULT_SWF = resolveDefaultSwf();
const FORCED_FULLSCREEN_ENTITY_BITMAP_SIZE = 2048;
const PREVIOUS_FORCED_FULLSCREEN_ENTITY_BITMAP_SIZE = 3072;

type Operand = [Instruction["operands"][number][0], number];
type InsertedInstruction =
  | { opcode: number; operands?: Operand[] };

function resolveDefaultSwf(): string {
  const candidates = [
    path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
    path.resolve(__dirname, "..", "..", "..", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
    path.resolve(process.cwd(), "src", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-superanim-method806-fullscreen-bitmapdata.ts [--verify] [--swf <path>]",
        "",
        "Patches SuperAnimData.method_806 fullscreen entity canvas BitmapData",
        "allocations so fullscreen scale cannot request invalid BitmapData sizes.",
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
  const chunks: Buffer[] = [];
  for (const inst of instructions) {
    const parts: Buffer[] = [Buffer.from([inst.opcode])];
    for (const [kind, value] of inst.operands ?? []) {
      parts.push(operandBytes(kind, value));
    }
    chunks.push(Buffer.concat(parts));
  }
  return Buffer.concat(chunks);
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

function getStaticMethod(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "SuperAnimData");
  if (classIndex === null) {
    throw new PatchError("Could not find SuperAnimData class.");
  }

  const methodIdx = methodIdxForTrait(abc.classTraits[classIndex], abc, "method_806");
  if (methodIdx === null) {
    throw new PatchError("Could not find SuperAnimData.method_806.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for SuperAnimData.method_806 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `SuperAnimData.method_806:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function findDynamicEntityBitmapDimensions(
  instructions: Instruction[],
  names: string[],
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < instructions.length - 5; index += 1) {
    const constructor = instructions[index];
    if (
      constructor.opcode !== 0x4a ||
      u30OperandName(constructor, names) !== "BitmapData" ||
      constructor.operands[1]?.[1] !== 4
    ) {
      continue;
    }

    const pushTrue = instructions[index - 2];
    const pushZero = instructions[index - 1];
    if (pushTrue?.opcode !== 0x26 || pushZero?.opcode !== 0x24 || pushZero.operands[0]?.[1] !== 0) {
      continue;
    }

    let bitmapDataClassIndex = -1;
    for (let scan = index - 3; scan >= 0 && scan >= index - 18; scan -= 1) {
      if (instructions[scan].opcode === 0x5d && u30OperandName(instructions[scan], names) === "BitmapData") {
        bitmapDataClassIndex = scan;
        break;
      }
    }
    if (bitmapDataClassIndex < 0) {
      continue;
    }

    const dimensionInstructions = instructions.slice(bitmapDataClassIndex + 1, index - 2);
    const usesEntityWidth = dimensionInstructions.some(
      (inst) => u30OperandName(inst, names) === "MAX_ENT_BMP_WIDTH",
    );
    const usesEntityHeight = dimensionInstructions.some(
      (inst) => u30OperandName(inst, names) === "MAX_ENT_BMP_HEIGHT",
    );
    if (!usesEntityWidth || !usesEntityHeight) {
      continue;
    }

    ranges.push({
      start: instructions[bitmapDataClassIndex + 1].offset,
      end: pushTrue.offset,
    });
  }

  if (ranges.length !== 2) {
    throw new PatchError(`Expected 2 dynamic entity BitmapData allocations, found ${ranges.length}.`);
  }

  return ranges;
}

function findForcedEntityBitmapDimensions(
  instructions: Instruction[],
  names: string[],
  forcedSize: number,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < instructions.length - 5; index += 1) {
    const find = instructions[index];
    const width = instructions[index + 1];
    const height = instructions[index + 2];
    const pushTrue = instructions[index + 3];
    const pushZero = instructions[index + 4];
    const construct = instructions[index + 5];
    if (
      find.opcode === 0x5d &&
      u30OperandName(find, names) === "BitmapData" &&
      width.opcode === 0x25 &&
      width.operands[0]?.[1] === forcedSize &&
      height.opcode === 0x25 &&
      height.operands[0]?.[1] === forcedSize &&
      pushTrue.opcode === 0x26 &&
      pushZero.opcode === 0x24 &&
      pushZero.operands[0]?.[1] === 0 &&
      construct.opcode === 0x4a &&
      u30OperandName(construct, names) === "BitmapData" &&
      construct.operands[1]?.[1] === 4
    ) {
      ranges.push({
        start: width.offset,
        end: pushTrue.offset,
      });
    }
  }

  return ranges;
}

function countForcedFullscreenEntityBitmapConstructors(instructions: Instruction[], names: string[]): number {
  return instructions.filter((instruction, index) =>
    instruction.opcode === 0x5d &&
    u30OperandName(instruction, names) === "BitmapData" &&
    instructions[index + 1]?.opcode === 0x25 &&
    instructions[index + 1]?.operands[0]?.[1] === FORCED_FULLSCREEN_ENTITY_BITMAP_SIZE &&
    instructions[index + 2]?.opcode === 0x25 &&
    instructions[index + 2]?.operands[0]?.[1] === FORCED_FULLSCREEN_ENTITY_BITMAP_SIZE &&
    instructions[index + 3]?.opcode === 0x26 &&
    instructions[index + 4]?.opcode === 0x24 &&
    instructions[index + 4]?.operands[0]?.[1] === 0 &&
    instructions[index + 5]?.opcode === 0x4a &&
    u30OperandName(instructions[index + 5], names) === "BitmapData" &&
    instructions[index + 5]?.operands[1]?.[1] === 4
  ).length;
}

function writePatchedMethod(
  swfPath: string,
  ctx: ReturnType<typeof parseSwf>,
  methodBody: ReturnType<typeof getStaticMethod>["methodBody"],
  patchedCode: Buffer,
): void {
  const patches: BytePatch[] = [
    {
      key: "SuperAnimData.method_806.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "force fullscreen-safe entity BitmapData dimensions",
    },
    {
      key: "SuperAnimData.method_806.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update method_806 code length",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getStaticMethod(swfPath);
  if (countForcedFullscreenEntityBitmapConstructors(instructions, abc.multinameNames) === 2) {
    console.log(`${swfPath}: already patched (SuperAnimData.method_806 fullscreen BitmapData dimensions present).`);
    return;
  }

  const previousRanges = findForcedEntityBitmapDimensions(
    instructions,
    abc.multinameNames,
    PREVIOUS_FORCED_FULLSCREEN_ENTITY_BITMAP_SIZE,
  );
  const ranges = previousRanges.length === 2 ? previousRanges : findDynamicEntityBitmapDimensions(instructions, abc.multinameNames);
  const forcedDimensions = assembleInserted([
    pushInteger(FORCED_FULLSCREEN_ENTITY_BITMAP_SIZE),
    pushInteger(FORCED_FULLSCREEN_ENTITY_BITMAP_SIZE),
  ]);

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; SuperAnimData.method_806 fullscreen BitmapData dimensions are missing.`);
  }

  const patchedCode = applyCodeEditsAndAdjustBranches(
    code,
    instructions,
    ranges.map((range) => ({ ...range, data: forcedDimensions })),
  );
  writePatchedMethod(swfPath, ctx, methodBody, patchedCode);
  console.log(`${swfPath}: patched SuperAnimData.method_806 fullscreen BitmapData dimensions.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
