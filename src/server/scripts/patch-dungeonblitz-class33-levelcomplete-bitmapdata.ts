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
  readU30,
  u30OperandName,
  writeSwf,
  writeU30,
} from "./swfPatchUtils";

const DEFAULT_SWF = resolveDefaultSwf();
const MAX_CACHE_BITMAP_WIDTH = 2048;
const MAX_CACHE_BITMAP_HEIGHT = 1152;

type Operand = [Instruction["operands"][number][0], number];

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-class33-levelcomplete-bitmapdata.ts [--verify] [--swf <path>]",
        "",
        "Patches class_33.method_298 so cached UI screens keep their",
        "actual hit bounds while oversized BitmapData allocations are clamped.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function pushShort(value: number): Buffer {
  return Buffer.concat([Buffer.from([0x25]), writeU30(value)]);
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
  if (kind === "s24") {
    return writeS24(value);
  }
  return Buffer.from([value & 0xff]);
}

function opcode(op: number, operands: Operand[] = []): Buffer {
  return Buffer.concat([Buffer.from([op]), ...operands.map(([kind, value]) => operandBytes(kind, value))]);
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

function adjustedOffset(offset: number, edits: Array<{ start: number; end: number; data: Buffer }>): number {
  let mapped = offset;
  for (const edit of edits) {
    if (edit.end <= offset || (edit.start === edit.end && edit.start <= offset)) {
      mapped += edit.data.length - (edit.end - edit.start);
    }
  }
  return mapped;
}

function getClass33Method298(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "class_33");
  if (classIndex === null) {
    throw new PatchError("Could not find class_33.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_298");
  if (methodIdx === null) {
    throw new PatchError("Could not find class_33.method_298.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for class_33.method_298 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `class_33.method_298:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function buildCatchHandler(catchLocal: number): Buffer {
  return Buffer.concat([
    opcode(0xd0),
    opcode(0x30),
    opcode(0x5a, [["u30", 0]]),
    opcode(0x2a),
    opcode(0x63, [["u30", catchLocal]]),
    opcode(0x2a),
    opcode(0x30),
    opcode(0x2b),
    opcode(0x6d, [["u30", 1]]),
    opcode(0x1d),
    opcode(0x08, [["u30", catchLocal]]),
    opcode(0x47),
  ]);
}

function buildDimensionClamp(minName: number, maxName: number): Buffer {
  return Buffer.concat([
    opcode(0x60, [["u30", 33]]),
    opcode(0xd2),
    pushShort(MAX_CACHE_BITMAP_WIDTH),
    opcode(0x46, [["u30", minName], ["u30", 2]]),
    opcode(0x74),
    opcode(0xd6),
    opcode(0x60, [["u30", 33]]),
    opcode(0xd3),
    pushShort(MAX_CACHE_BITMAP_HEIGHT),
    opcode(0x46, [["u30", minName], ["u30", 2]]),
    opcode(0x74),
    opcode(0xd7),
    opcode(0x60, [["u30", 33]]),
    opcode(0xd2),
    opcode(0x24, [["s8", 1]]),
    opcode(0x46, [["u30", maxName], ["u30", 2]]),
    opcode(0x74),
    opcode(0xd6),
    opcode(0x60, [["u30", 33]]),
    opcode(0xd3),
    opcode(0x24, [["s8", 1]]),
    opcode(0x46, [["u30", maxName], ["u30", 2]]),
    opcode(0x74),
    opcode(0xd7),
  ]);
}

function findBitmapDataConstructorArgs(
  instructions: Instruction[],
  names: string[],
): { find: Instruction; width: Instruction; height: Instruction; construct: Instruction } {
  for (let index = 0; index < instructions.length - 5; index += 1) {
    if (
      instructions[index].opcode === 0x5d &&
      u30OperandName(instructions[index], names) === "BitmapData" &&
      (instructions[index + 1]?.opcode === 0xd2 || instructions[index + 1]?.opcode === 0x25) &&
      (instructions[index + 2]?.opcode === 0xd3 || instructions[index + 2]?.opcode === 0x25) &&
      instructions[index + 3]?.opcode === 0x26 &&
      instructions[index + 4]?.opcode === 0x24 &&
      instructions[index + 4]?.operands[0]?.[1] === 0 &&
      instructions[index + 5]?.opcode === 0x4a &&
      u30OperandName(instructions[index + 5], names) === "BitmapData" &&
      instructions[index + 5]?.operands[1]?.[1] === 4
    ) {
      return {
        find: instructions[index],
        width: instructions[index + 1],
        height: instructions[index + 2],
        construct: instructions[index + 5],
      };
    }
  }

  throw new PatchError("Could not find class_33.method_298 BitmapData constructor.");
}

function findClampedBitmapDataConstructor(
  instructions: Instruction[],
  names: string[],
): { find: Instruction; construct: Instruction } | null {
  const index = instructions.findIndex((instruction, candidateIndex) =>
    instruction.opcode === 0x5d &&
    u30OperandName(instruction, names) === "BitmapData" &&
    instructions[candidateIndex + 1]?.opcode === 0xd2 &&
    instructions[candidateIndex + 2]?.opcode === 0xd3 &&
    instructions[candidateIndex + 3]?.opcode === 0x26 &&
    instructions[candidateIndex + 4]?.opcode === 0x24 &&
    instructions[candidateIndex + 4]?.operands[0]?.[1] === 0 &&
    instructions[candidateIndex + 5]?.opcode === 0x4a &&
    u30OperandName(instructions[candidateIndex + 5], names) === "BitmapData" &&
    instructions[candidateIndex + 5]?.operands[1]?.[1] === 4
  );

  if (index < 0) {
    return null;
  }

  return { find: instructions[index], construct: instructions[index + 5] };
}

function hasDimensionClamp(instructions: Instruction[], names: string[]): boolean {
  return instructions.some((instruction, index) =>
    instruction.opcode === 0x60 &&
    u30OperandName(instruction, names) === "Math" &&
    instructions[index + 1]?.opcode === 0xd2 &&
    instructions[index + 2]?.opcode === 0x25 &&
    instructions[index + 2]?.operands[0]?.[1] === MAX_CACHE_BITMAP_WIDTH &&
    instructions[index + 3]?.opcode === 0x46 &&
    u30OperandName(instructions[index + 3], names) === "min" &&
    instructions[index + 4]?.opcode === 0x74 &&
    instructions[index + 5]?.opcode === 0xd6 &&
    instructions[index + 6]?.opcode === 0x60 &&
    u30OperandName(instructions[index + 6], names) === "Math" &&
    instructions[index + 7]?.opcode === 0xd3 &&
    instructions[index + 8]?.opcode === 0x25 &&
    instructions[index + 8]?.operands[0]?.[1] === MAX_CACHE_BITMAP_HEIGHT &&
    instructions[index + 9]?.opcode === 0x46 &&
    u30OperandName(instructions[index + 9], names) === "min"
  );
}

function findHeightSetLocal3(instructions: Instruction[], names: string[]): Instruction {
  const index = instructions.findIndex((instruction, candidateIndex) =>
    instruction.opcode === 0x60 &&
    u30OperandName(instruction, names) === "Math" &&
    instructions[candidateIndex + 1]?.opcode === 0xd0 &&
    instructions[candidateIndex + 2]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 2], names) === "var_271" &&
    instructions[candidateIndex + 3]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 3], names) === "height" &&
    instructions[candidateIndex + 4]?.opcode === 0xd1 &&
    instructions[candidateIndex + 5]?.opcode === 0xa2 &&
    instructions[candidateIndex + 6]?.opcode === 0x46 &&
    u30OperandName(instructions[candidateIndex + 6], names) === "ceil" &&
    instructions[candidateIndex + 7]?.opcode === 0x74 &&
    instructions[candidateIndex + 8]?.opcode === 0xd7
  );

  if (index < 0) {
    throw new PatchError("Could not find class_33.method_298 height calculation.");
  }

  return instructions[index + 8];
}

function hasBitmapDataCrashGuard(
  methodBody: ReturnType<typeof getClass33Method298>["methodBody"],
  construct: Instruction,
  errorName: number,
): boolean {
  return methodBody.exceptions.some((entry) =>
    entry.from <= construct.offset &&
    entry.to >= construct.offset + construct.size &&
    entry.type === errorName &&
    entry.target > construct.offset
  );
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getClass33Method298(swfPath);
  const errorName = findRequiredMultiname(abc, "Error");
  const catchName = findRequiredMultiname(abc, "error");
  const constructor = findBitmapDataConstructorArgs(instructions, abc.multinameNames);
  const clampedConstructor = findClampedBitmapDataConstructor(instructions, abc.multinameNames);
  const alreadyHasClamp = hasDimensionClamp(instructions, abc.multinameNames);
  const hasCrashGuard = hasBitmapDataCrashGuard(methodBody, constructor.construct, errorName);

  if (clampedConstructor && alreadyHasClamp && hasCrashGuard) {
    console.log(`${swfPath}: already patched (class_33.method_298 clamped BitmapData guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; class_33.method_298 clamped BitmapData guard is missing.`);
  }

  if (methodBody.exceptionCount !== 0 && !hasCrashGuard) {
    throw new PatchError("class_33.method_298 already has unexpected exception handlers.");
  }

  const edits: Array<{ start: number; end: number; data: Buffer }> = [];
  if (!clampedConstructor) {
    edits.push({
      start: constructor.width.offset,
      end: constructor.height.offset + constructor.height.size,
      data: Buffer.from([0xd2, 0xd3]),
    });
  }

  if (!alreadyHasClamp) {
    const heightSet = findHeightSetLocal3(instructions, abc.multinameNames);
    edits.push({
      start: heightSet.offset + heightSet.size,
      end: heightSet.offset + heightSet.size,
      data: buildDimensionClamp(
        findRequiredMultiname(abc, "min"),
        findRequiredMultiname(abc, "max"),
      ),
    });
  }

  const orderedEdits = edits.sort((left, right) => left.start - right.start);
  const dimensionPatchedCode = orderedEdits.length === 0
    ? code
    : applyCodeEditsAndAdjustBranches(code, instructions, orderedEdits);
  const dimensionPatchedInstructions = disassemble(dimensionPatchedCode, "class_33.method_298:patched");
  const patchedConstructor = findClampedBitmapDataConstructor(dimensionPatchedInstructions, abc.multinameNames);
  if (!patchedConstructor) {
    throw new PatchError("class_33.method_298 clamped BitmapData constructor not found after patch.");
  }

  const [localCount, localCountEnd] = readU30(ctx.body, methodBody.localCountPos, "class_33.method_298.local_count");
  const handler = buildCatchHandler(localCount);
  const handlerOffset = dimensionPatchedCode.length;
  const patchedCode = hasCrashGuard ? dimensionPatchedCode : Buffer.concat([dimensionPatchedCode, handler]);
  const exceptionTarget = hasCrashGuard ? adjustedOffset(methodBody.exceptions[0].target, orderedEdits) : handlerOffset;
  const exceptionTable = Buffer.concat([
    writeU30(1),
    writeU30(patchedConstructor.find.offset),
    writeU30(patchedConstructor.construct.offset + patchedConstructor.construct.size),
    writeU30(exceptionTarget),
    writeU30(errorName),
    writeU30(catchName),
  ]);

  const patches: BytePatch[] = [
    ...(hasCrashGuard
      ? []
      : [
          {
            key: "class_33.method_298.localCount",
            start: methodBody.localCountPos,
            end: localCountEnd,
            data: writeU30(localCount + 1),
            detail: "add catch local",
          },
          {
            key: "class_33.method_298.maxScopeDepth",
            start: methodBody.maxScopeDepthPos,
            end: methodBody.codeLenPos,
            data: writeU30(Math.max(methodBody.maxScopeDepth, 6)),
            detail: "allow catch scope",
          },
        ]),
    {
      key: "class_33.method_298.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "clamp cached UI BitmapData dimensions and catch allocation errors",
    },
    {
      key: "class_33.method_298.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update class_33.method_298 code length",
    },
    {
      key: "class_33.method_298.exceptionTable",
      start: methodBody.exceptionCountPos,
      end: methodBody.traitsCountPos,
      data: exceptionTable,
      detail: "catch class_33 cache BitmapData allocation errors",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched class_33.method_298 clamped BitmapData guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
