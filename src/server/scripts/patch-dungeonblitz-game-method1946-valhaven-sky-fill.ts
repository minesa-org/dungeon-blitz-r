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

const VALHAVEN_SKY_FILL = 0xffcc66;

type Operand = [Instruction["operands"][number][0] | "string", number];
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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-game-method1946-valhaven-sky-fill.ts [--verify] [--swf <path>]",
        "",
        "Patches Game.method_1946 so Valhaven/JadeCity clears the final world",
        "canvas to a warm sky color before drawing level layers. This covers",
        "transparent fullscreen sky gaps without changing fullscreen scale.",
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
  if (kind === "u30" || kind === "string") {
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

function getProperty(nameIndex: number): InsertedInstruction {
  return { opcode: 0x66, operands: [["u30", nameIndex]] };
}

function callPropVoid(nameIndex: number, argCount: number): InsertedInstruction {
  return { opcode: 0x4f, operands: [["u30", nameIndex], ["u30", argCount]] };
}

function pushString(index: number): InsertedInstruction {
  return { opcode: 0x2c, operands: [["string", index]] };
}

function pushInteger(value: number): InsertedInstruction {
  if (value >= -128 && value <= 127) {
    return { opcode: 0x24, operands: [["s8", value]] };
  }
  return { opcode: 0x25, operands: [["u30", value]] };
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function findRequiredString(abc: ReturnType<typeof parseAbc>, value: string): number {
  const index = abc.stringValues.findIndex((candidate) => candidate === value);
  if (index < 0) {
    throw new PatchError(`String ${value} not found.`);
  }
  return index;
}

function valhavenSkyFillInstructions(abc: ReturnType<typeof parseAbc>): InsertedInstruction[] {
  const levelName = findRequiredMultiname(abc, "level");
  const internalNameName = findRequiredMultiname(abc, "internalName");
  const rectName = findRequiredMultiname(abc, "rect");
  const fillRectName = findRequiredMultiname(abc, "fillRect");
  const jadeCityString = findRequiredString(abc, "JadeCity");
  const jadeCityHardString = findRequiredString(abc, "JadeCityHard");

  return [
    getLocal(0),
    getProperty(levelName),
    { opcode: 0x12, branchTo: "end" },

    getLocal(0),
    getProperty(levelName),
    getProperty(internalNameName),
    pushString(jadeCityString),
    { opcode: 0xab },
    { opcode: 0x11, branchTo: "fill" },

    getLocal(0),
    getProperty(levelName),
    getProperty(internalNameName),
    pushString(jadeCityHardString),
    { opcode: 0xab },
    { opcode: 0x12, branchTo: "end" },

    { label: "fill" },
    getLocal(4),
    getLocal(4),
    getProperty(rectName),
    pushInteger(VALHAVEN_SKY_FILL),
    callPropVoid(fillRectName, 2),

    { label: "end" },
  ];
}

function getGameMethod1946(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Game");
  if (classIndex === null) {
    throw new PatchError("Could not find Game class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1946");
  if (methodIdx === null) {
    throw new PatchError("Could not find Game.method_1946.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for Game.method_1946 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Game.method_1946:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function setLocalOperand(inst: Instruction | undefined): number | null {
  if (!inst) {
    return null;
  }
  if (inst.opcode >= 0xd4 && inst.opcode <= 0xd7) {
    return inst.opcode - 0xd4;
  }
  if (inst.opcode === 0x63 && inst.operands[0]?.[0] === "u30") {
    return inst.operands[0][1];
  }
  return null;
}

function findBitmapDataLocalAssignment(instructions: Instruction[], names: string[]): Instruction {
  for (let index = 0; index < instructions.length - 4; index += 1) {
    if (
      u30OperandName(instructions[index], names) === "var_147" &&
      u30OperandName(instructions[index + 1], names) === "bitmapData" &&
      setLocalOperand(instructions[index + 3]) === 4
    ) {
      return instructions[index + 3];
    }
  }

  throw new PatchError("Could not find Game.method_1946 final canvas BitmapData local assignment.");
}

function hasValhavenSkyFill(instructions: Instruction[], abc: ReturnType<typeof parseAbc>): boolean {
  const hasJadeCity = instructions.some((inst) =>
    inst.opcode === 0x2c &&
    inst.operands[0]?.[0] === "u30" &&
    abc.stringValues[inst.operands[0][1]] === "JadeCity"
  );
  const hasJadeCityHard = instructions.some((inst) =>
    inst.opcode === 0x2c &&
    inst.operands[0]?.[0] === "u30" &&
    abc.stringValues[inst.operands[0][1]] === "JadeCityHard"
  );
  const hasSkyColor = instructions.some((inst) => inst.opcode === 0x25 && inst.operands[0]?.[1] === VALHAVEN_SKY_FILL);
  const hasFillRect = instructions.some((inst) => inst.opcode === 0x4f && u30OperandName(inst, abc.multinameNames) === "fillRect");
  return hasJadeCity && hasJadeCityHard && hasSkyColor && hasFillRect;
}

function writePatchedMethod(
  swfPath: string,
  ctx: ReturnType<typeof parseSwf>,
  methodBody: ReturnType<typeof getGameMethod1946>["methodBody"],
  patchedCode: Buffer,
): void {
  const patches: BytePatch[] = [
    {
      key: "Game.method_1946.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "insert Valhaven final-canvas sky fill",
    },
    {
      key: "Game.method_1946.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update Game.method_1946 code length",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getGameMethod1946(swfPath);
  if (hasValhavenSkyFill(instructions, abc)) {
    console.log(`${swfPath}: already patched (Game.method_1946 Valhaven sky fill present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1946 Valhaven sky fill is missing.`);
  }

  const assignment = findBitmapDataLocalAssignment(instructions, abc.multinameNames);
  const fill = assembleInserted(valhavenSkyFillInstructions(abc));
  const patchedCode = applyCodeEditsAndAdjustBranches(code, instructions, [
    { start: assignment.offset + assignment.size, end: assignment.offset + assignment.size, data: fill },
  ]);
  writePatchedMethod(swfPath, ctx, methodBody, patchedCode);
  console.log(`${swfPath}: patched Game.method_1946 Valhaven sky fill.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
