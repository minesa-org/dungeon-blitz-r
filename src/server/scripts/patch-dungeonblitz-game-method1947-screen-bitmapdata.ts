import * as fs from "fs";
import * as path from "path";
import {
  applyPatchesToBody,
  BytePatch,
  classIndexByName,
  disassemble,
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
const SAFE_SCREEN_BITMAP_WIDTH = 2048;
const SAFE_SCREEN_BITMAP_HEIGHT = 1152;

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
        "  ts-node src/server/scripts/patch-dungeonblitz-game-method1947-screen-bitmapdata.ts [--verify] [--swf <path>]",
        "",
        "Patches Game.method_1947 so the fullscreen screen-buffer BitmapData",
        "uses a safe fullscreen backing size instead of unbounded overallScale dimensions.",
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

function isBranchOpcode(opcodeValue: number): boolean {
  return opcodeValue >= 0x0c && opcodeValue <= 0x1a;
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

function adjustedOffset(offset: number, editStart: number, delta: number): number {
  return offset >= editStart ? offset + delta : offset;
}

function getGameMethod1947(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Game");
  if (classIndex === null) {
    throw new PatchError("Could not find Game class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1947");
  if (methodIdx === null) {
    throw new PatchError("Could not find Game.method_1947.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for Game.method_1947 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Game.method_1947:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function findScreenBitmapConstructor(instructions: Instruction[], names: string[]) {
  for (let index = 0; index < instructions.length - 3; index += 1) {
    const find = instructions[index];
    const construct = instructions.find((candidate, candidateIndex) =>
      candidateIndex > index &&
      candidate.offset - find.offset < 80 &&
      candidate.opcode === 0x4a &&
      u30OperandName(candidate, names) === "BitmapData" &&
      candidate.operands[1]?.[1] === 3
    );
    if (
      find.opcode === 0x5d &&
      u30OperandName(find, names) === "BitmapData" &&
      construct
    ) {
      return { find, construct };
    }
  }

  throw new PatchError("Could not find Game.method_1947 screen BitmapData constructor.");
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function findGetChildIndexBlock(instructions: Instruction[], names: string[]): { start: number; end: number } {
  for (let index = 0; index < instructions.length - 13; index += 1) {
    if (
      instructions[index].opcode === 0xd0 &&
      instructions[index + 1]?.opcode === 0x66 &&
      u30OperandName(instructions[index + 1], names) === "main" &&
      instructions[index + 2]?.opcode === 0xd0 &&
      instructions[index + 3]?.opcode === 0x66 &&
      u30OperandName(instructions[index + 3], names) === "main" &&
      instructions[index + 4]?.opcode === 0x66 &&
      u30OperandName(instructions[index + 4], names) === "var_147" &&
      instructions[index + 5]?.opcode === 0xd0 &&
      instructions[index + 6]?.opcode === 0x66 &&
      u30OperandName(instructions[index + 6], names) === "main" &&
      instructions[index + 7]?.opcode === 0xd0 &&
      instructions[index + 8]?.opcode === 0x66 &&
      u30OperandName(instructions[index + 8], names) === "main" &&
      instructions[index + 9]?.opcode === 0x66 &&
      u30OperandName(instructions[index + 9], names) === "var_374" &&
      instructions[index + 10]?.opcode === 0x46 &&
      u30OperandName(instructions[index + 10], names) === "getChildIndex" &&
      instructions[index + 13]?.opcode === 0x4f &&
      u30OperandName(instructions[index + 13], names) === "addChildAt"
    ) {
      return {
        start: instructions[index].offset,
        end: instructions[index + 13].offset + instructions[index + 13].size,
      };
    }
  }

  throw new PatchError("Could not find Game.method_1947 getChildIndex/addChildAt block.");
}

function buildGetChildIndexGuard(
  mainName: number,
  snapshotName: number,
  anchorName: number,
  parentName: number,
  addChildName: number,
  originalBlockLength: number,
): Buffer {
  const prefix = Buffer.concat([
    opcode(0xd0),
    opcode(0x66, [["u30", mainName]]),
    opcode(0x66, [["u30", anchorName]]),
    opcode(0x2a),
  ]);
  const ifHasAnchorOffset = prefix.length;
  const ifHasAnchor = opcode(0x11, [["s24", 0]]);
  const nullAnchor = Buffer.concat([
    opcode(0x29),
    opcode(0x10, [["s24", 0]]),
  ]);
  const hasAnchor = Buffer.concat([
    opcode(0x66, [["u30", parentName]]),
    opcode(0xd0),
    opcode(0x66, [["u30", mainName]]),
    opcode(0xab),
  ]);
  const ifOkOffset = prefix.length + ifHasAnchor.length + nullAnchor.length + hasAnchor.length;
  const ifOk = opcode(0x11, [["s24", 0]]);
  const fallbackOffset = ifOkOffset + ifOk.length;
  const fallback = Buffer.concat([
    opcode(0xd0),
    opcode(0x66, [["u30", mainName]]),
    opcode(0xd0),
    opcode(0x66, [["u30", mainName]]),
    opcode(0x66, [["u30", snapshotName]]),
    opcode(0x4f, [["u30", addChildName], ["u30", 1]]),
  ]);
  const jumpOriginal = opcode(0x10, [["s24", originalBlockLength]]);
  const okOffset = fallbackOffset + fallback.length + jumpOriginal.length;
  const patchedIfHasAnchor = opcode(0x11, [["s24", (prefix.length + ifHasAnchor.length + nullAnchor.length) - (ifHasAnchorOffset + ifHasAnchor.length)]]);
  const patchedNullAnchor = Buffer.concat([
    opcode(0x29),
    opcode(0x10, [["s24", fallbackOffset - (prefix.length + ifHasAnchor.length + 1 + 4)]]),
  ]);
  const patchedIfOk = opcode(0x11, [["s24", okOffset - (ifOkOffset + ifOk.length)]]);

  return Buffer.concat([
    prefix,
    patchedIfHasAnchor,
    patchedNullAnchor,
    hasAnchor,
    patchedIfOk,
    fallback,
    jumpOriginal,
  ]);
}

function hasGetChildIndexGuard(code: Buffer, blockStart: number, guardPrefix: Buffer): boolean {
  return blockStart >= guardPrefix.length && code.subarray(blockStart - guardPrefix.length, blockStart).equals(guardPrefix);
}

function isPatched(code: Buffer, constructorStart: number, constructOffset: number): boolean {
  const prefix = Buffer.concat([
    pushShort(SAFE_SCREEN_BITMAP_WIDTH),
    pushShort(SAFE_SCREEN_BITMAP_HEIGHT),
  ]);
  return code.subarray(constructorStart, constructorStart + prefix.length).equals(prefix) &&
    code.subarray(constructorStart + prefix.length, constructOffset).every((byte) => byte === 0x02);
}

function buildCatchHandler(catchLocal: number): Buffer {
  return Buffer.concat([
    opcode(0xd0), // getlocal0
    opcode(0x30), // pushscope
    opcode(0x5a, [["u30", 0]]), // newcatch 0
    opcode(0x2a), // dup
    opcode(0x63, [["u30", catchLocal]]), // setlocal catchLocal
    opcode(0x2a), // dup
    opcode(0x30), // pushscope
    opcode(0x2b), // swap
    opcode(0x6d, [["u30", 1]]), // setslot 1
    opcode(0x1d), // popscope
    opcode(0x08, [["u30", catchLocal]]), // kill catchLocal
    opcode(0x47), // returnvoid
  ]);
}

function hasBitmapDataCrashGuard(
  methodBody: ReturnType<typeof getGameMethod1947>["methodBody"],
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
  const { ctx, abc, methodBody, code, instructions } = getGameMethod1947(swfPath);
  const { find, construct } = findScreenBitmapConstructor(instructions, abc.multinameNames);
  const constructorArgsStart = find.offset + find.size;
  const constructorArgsEnd = construct.offset - 1;
  const errorName = findRequiredMultiname(abc, "Error");
  const catchName = findRequiredMultiname(abc, "error");
  const hasCrashGuard = hasBitmapDataCrashGuard(methodBody, construct, errorName);
  const childIndexBlock = findGetChildIndexBlock(instructions, abc.multinameNames);
  const childIndexGuard = buildGetChildIndexGuard(
    findRequiredMultiname(abc, "main"),
    findRequiredMultiname(abc, "var_147"),
    findRequiredMultiname(abc, "var_374"),
    findRequiredMultiname(abc, "parent"),
    findRequiredMultiname(abc, "addChild"),
    childIndexBlock.end - childIndexBlock.start,
  );
  const hasChildIndexGuard = hasGetChildIndexGuard(code, childIndexBlock.start, childIndexGuard);

  if (constructorArgsEnd <= constructorArgsStart) {
    throw new PatchError("Unexpected Game.method_1947 BitmapData argument range.");
  }

  if (isPatched(code, constructorArgsStart, constructorArgsEnd) && hasCrashGuard && hasChildIndexGuard) {
    console.log(`${swfPath}: already patched (Game.method_1947 safe screen BitmapData guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1947 safe screen BitmapData guard is missing.`);
  }

  if (methodBody.exceptionCount !== 0 && !hasCrashGuard) {
    throw new PatchError("Game.method_1947 already has unexpected exception handlers.");
  }

  const replacementPrefix = Buffer.concat([
    pushShort(SAFE_SCREEN_BITMAP_WIDTH),
    pushShort(SAFE_SCREEN_BITMAP_HEIGHT),
  ]);
  const replacement = Buffer.concat([
    replacementPrefix,
    Buffer.alloc(constructorArgsEnd - constructorArgsStart - replacementPrefix.length, 0x02),
  ]);
  const guardedCode = hasChildIndexGuard
    ? code
    : applyCodeEditsAndAdjustBranches(code, instructions, [
        { start: childIndexBlock.start, end: childIndexBlock.start, data: childIndexGuard },
      ]);
  const childGuardDelta = guardedCode.length - code.length;
  const adjustedConstructorArgsStart = adjustedOffset(constructorArgsStart, childIndexBlock.start, childGuardDelta);
  const adjustedConstructorArgsEnd = adjustedOffset(constructorArgsEnd, childIndexBlock.start, childGuardDelta);
  const adjustedFindOffset = adjustedOffset(find.offset, childIndexBlock.start, childGuardDelta);
  const adjustedConstructEnd = adjustedOffset(construct.offset + construct.size, childIndexBlock.start, childGuardDelta);
  const [localCount, localCountEnd] = readU30(ctx.body, methodBody.localCountPos, "Game.method_1947.local_count");
  const handler = buildCatchHandler(localCount);
  const handlerOffset = guardedCode.length;
  const patchedCode = hasCrashGuard ? guardedCode : Buffer.concat([guardedCode, handler]);
  const exceptionTable = hasCrashGuard
    ? Buffer.concat([
        writeU30(1),
        writeU30(adjustedOffset(methodBody.exceptions[0].from, childIndexBlock.start, childGuardDelta)),
        writeU30(adjustedOffset(methodBody.exceptions[0].to, childIndexBlock.start, childGuardDelta)),
        writeU30(adjustedOffset(methodBody.exceptions[0].target, childIndexBlock.start, childGuardDelta)),
        writeU30(methodBody.exceptions[0].type),
        writeU30(methodBody.exceptions[0].name),
      ])
    : Buffer.concat([
        writeU30(1),
        writeU30(adjustedFindOffset),
        writeU30(adjustedConstructEnd),
        writeU30(handlerOffset),
        writeU30(errorName),
        writeU30(catchName),
      ]);

  const patches: BytePatch[] = [
    {
      key: "Game.method_1947.screen_bitmap_dimensions",
      start: methodBody.codeStart + adjustedConstructorArgsStart,
      end: methodBody.codeStart + adjustedConstructorArgsEnd,
      data: replacement,
      detail: "force screen BitmapData dimensions to 2048x1152",
    },
    ...(hasCrashGuard
      ? []
      : [
          {
            key: "Game.method_1947.localCount",
            start: methodBody.localCountPos,
            end: localCountEnd,
            data: writeU30(localCount + 1),
            detail: "add catch local",
          },
          {
            key: "Game.method_1947.maxScopeDepth",
            start: methodBody.maxScopeDepthPos,
            end: methodBody.codeLenPos,
            data: writeU30(Math.max(methodBody.maxScopeDepth, 6)),
            detail: "allow catch scope",
          },
        ]),
    ...((hasChildIndexGuard && hasCrashGuard)
      ? []
      : [
          {
            key: "Game.method_1947.code",
            start: methodBody.codeStart,
            end: methodBody.codeStart + methodBody.codeLen,
            data: patchedCode,
            detail: "guard transition snapshot getChildIndex fallback",
          },
          {
            key: "Game.method_1947.codeLen",
            start: methodBody.codeLenPos,
            end: methodBody.codeStart,
            data: writeU30(patchedCode.length),
            detail: "update Game.method_1947 code length",
          },
          {
            key: "Game.method_1947.exceptionTable",
            start: methodBody.exceptionCountPos,
            end: methodBody.traitsCountPos,
            data: exceptionTable,
            detail: "catch screen BitmapData allocation errors",
          },
        ]),
  ];

  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Game.method_1947 safe screen BitmapData guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
