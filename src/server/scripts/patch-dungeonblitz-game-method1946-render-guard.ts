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
  writeSwf,
  writeU30,
} from "./swfPatchUtils";

const DEFAULT_SWF = resolveDefaultSwf();

type Operand = [Instruction["operands"][number][0], number];
type InsertedInstruction =
  | { label: string }
  | { opcode: number; operands?: Operand[]; branchTo?: string };

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-game-method1946-render-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches Game.method_1946 so null render/snapshot state skips the",
        "current frame instead of crashing the client.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
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

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function getGameMethod1946(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Game");
  if (classIndex === null) {
    throw new PatchError("Game class not found.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1946");
  if (methodIdx === null) {
    throw new PatchError("Game.method_1946 not found.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Game.method_1946 body not found (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Game.method_1946:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function findRenderRange(
  methodBody: ReturnType<typeof getGameMethod1946>["methodBody"],
  instructions: Instruction[],
): { from: number; to: number } {
  const pushScopeIndex = instructions.findIndex((instruction) => instruction.opcode === 0x30);
  if (pushScopeIndex < 0) {
    throw new PatchError("Could not locate Game.method_1946 render body.");
  }

  const firstBodyInstruction = instructions[pushScopeIndex + 1];
  if (!firstBodyInstruction) {
    throw new PatchError("Game.method_1946 render body is empty.");
  }

  return {
    from: firstBodyInstruction.offset,
    to: methodBody.exceptions[0]?.to ?? instructions[instructions.length - 1].offset,
  };
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

function findSnapshotBitmapRead(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): Instruction {
  for (let index = 0; index < instructions.length - 4; index += 1) {
    const self = instructions[index];
    const main = instructions[index + 1];
    const bitmap = instructions[index + 2];
    const bitmapData = instructions[index + 3];
    const coerce = instructions[index + 4];
    if (
      self.opcode === 0xd0 &&
      main.opcode === 0x66 &&
      abc.multinameNames[main.operands[0]?.[1] ?? -1] === "main" &&
      bitmap.opcode === 0x66 &&
      abc.multinameNames[bitmap.operands[0]?.[1] ?? -1] === "var_147" &&
      bitmapData.opcode === 0x66 &&
      abc.multinameNames[bitmapData.operands[0]?.[1] ?? -1] === "bitmapData" &&
      coerce.opcode === 0x80 &&
      abc.multinameNames[coerce.operands[0]?.[1] ?? -1] === "BitmapData"
    ) {
      return self;
    }
  }

  throw new PatchError("Could not find Game.method_1946 snapshot bitmapData read.");
}

function buildSnapshotBitmapGuard(mainName: number, bitmapName: number, bitmapDataName: number): Buffer {
  return assembleInserted([
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", mainName]] },
    { opcode: 0x66, operands: [["u30", bitmapName]] },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasBitmap" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasBitmap" },
    { opcode: 0x66, operands: [["u30", bitmapDataName]] },
    { opcode: 0x11, branchTo: "ok" },
    { opcode: 0x47 },
    { label: "ok" },
  ]);
}

function hasCrashGuard(swfPath: string): boolean {
  const { abc, methodBody, instructions } = getGameMethod1946(swfPath);
  const range = findRenderRange(methodBody, instructions);
  const errorName = findRequiredMultiname(abc, "Error");
  return methodBody.exceptions.some((entry) =>
    entry.from === range.from &&
    entry.to === range.to &&
    entry.type === errorName &&
    entry.target >= range.to &&
    entry.target < methodBody.codeLen
  );
}

function hasSnapshotBitmapGuard(swfPath: string): boolean {
  const { abc, code, instructions } = getGameMethod1946(swfPath);
  const read = findSnapshotBitmapRead(instructions, abc);
  const guard = buildSnapshotBitmapGuard(
    findRequiredMultiname(abc, "main"),
    findRequiredMultiname(abc, "var_147"),
    findRequiredMultiname(abc, "bitmapData"),
  );
  return read.offset >= guard.length && code.subarray(read.offset - guard.length, read.offset).equals(guard);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getGameMethod1946(swfPath);
  const range = findRenderRange(methodBody, instructions);
  const errorName = findRequiredMultiname(abc, "Error");
  const catchName = findRequiredMultiname(abc, "error");
  const [localCount, localCountEnd] = readU30(ctx.body, methodBody.localCountPos, "Game.method_1946.local_count");
  const snapshotRead = findSnapshotBitmapRead(instructions, abc);
  const snapshotGuard = buildSnapshotBitmapGuard(
    findRequiredMultiname(abc, "main"),
    findRequiredMultiname(abc, "var_147"),
    findRequiredMultiname(abc, "bitmapData"),
  );
  const alreadyHasSnapshotGuard =
    snapshotRead.offset >= snapshotGuard.length &&
    code.subarray(snapshotRead.offset - snapshotGuard.length, snapshotRead.offset).equals(snapshotGuard);

  if (hasCrashGuard(swfPath) && alreadyHasSnapshotGuard) {
    console.log(`${swfPath}: already patched (Game.method_1946 render crash guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1946 render crash guard is missing.`);
  }

  if (methodBody.exceptionCount !== 0 && !hasCrashGuard(swfPath)) {
    throw new PatchError("Game.method_1946 already has unexpected exception handlers.");
  }

  const handler = buildCatchHandler(localCount);
  const editedCode = alreadyHasSnapshotGuard
    ? code
    : applyCodeEditsAndAdjustBranches(code, instructions, [
        { start: snapshotRead.offset, end: snapshotRead.offset, data: snapshotGuard },
      ]);
  const guardDelta = editedCode.length - code.length;
  const addCatch = !hasCrashGuard(swfPath);
  const patchedCode = addCatch ? Buffer.concat([editedCode, handler]) : editedCode;
  const exceptionTable = Buffer.concat([
    writeU30(1),
    writeU30(adjustedOffset(range.from, snapshotRead.offset, guardDelta)),
    writeU30(adjustedOffset(range.to, snapshotRead.offset, guardDelta)),
    writeU30(addCatch ? editedCode.length : adjustedOffset(methodBody.exceptions[0].target, snapshotRead.offset, guardDelta)),
    writeU30(errorName),
    writeU30(catchName),
  ]);

  const patches: BytePatch[] = [
    ...(addCatch
      ? [{
          key: "Game.method_1946.localCount",
          start: methodBody.localCountPos,
          end: localCountEnd,
          data: writeU30(localCount + 1),
          detail: "add catch local",
        }]
      : []),
    {
      key: "Game.method_1946.maxScopeDepth",
      start: methodBody.maxScopeDepthPos,
      end: methodBody.codeLenPos,
      data: writeU30(Math.max(methodBody.maxScopeDepth, 6)),
      detail: "allow catch scope",
    },
    {
      key: "Game.method_1946.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "append render catch handler",
    },
    {
      key: "Game.method_1946.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update Game.method_1946 code length",
    },
    {
      key: "Game.method_1946.exceptionTable",
      start: methodBody.exceptionCountPos,
      end: methodBody.traitsCountPos,
      data: exceptionTable,
      detail: "catch render null errors",
    },
  ];

  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Game.method_1946 render crash guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
if (verify) {
  if (!hasCrashGuard(swfPath) || !hasSnapshotBitmapGuard(swfPath)) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1946 render crash guard is missing.`);
  }
  console.log(`${swfPath}: verified Game.method_1946 render crash guard.`);
} else {
  patchSwf(swfPath, false);
}
