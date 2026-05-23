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
const DEFAULT_SOURCE_SWF = `${DEFAULT_SWF}.bak`;
const MAX_DAMAGE_TEXT = 4000000;
const FLOATER_MARGIN = 40;

type Operand = [Instruction["operands"][number][0], number];

function parseArgs(argv: string[]): { swfPath: string; sourceSwfPath: string; verify: boolean } {
  let swfPath = DEFAULT_SWF;
  let sourceSwfPath = DEFAULT_SOURCE_SWF;
  let verify = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--swf" || arg === "-s") {
      swfPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--source-swf") {
      sourceSwfPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--verify" || arg === "--dry-run") {
      verify = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-game-method527-clamp-floaters.ts [--verify] [--swf <path>] [--source-swf <path>]",
        "",
        "Restores Game.method_527 damage floaters from the source SWF, then clamps",
        "their displayed damage and on-screen position before class_72 allocates text bitmaps.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, sourceSwfPath, verify };
}

function instruction(opcode: number, operands: Buffer[] = []): Buffer {
  return Buffer.concat([Buffer.from([opcode]), ...operands]);
}

function pushByte(value: number): Buffer {
  return instruction(0x24, [Buffer.from([value & 0xff])]);
}

function pushShort(value: number): Buffer {
  return instruction(0x25, [writeU30(value)]);
}

function getLocal(localIndex: number): Buffer {
  if (localIndex >= 0 && localIndex <= 3) {
    return instruction(0xd0 + localIndex);
  }
  return instruction(0x62, [writeU30(localIndex)]);
}

function setLocal(localIndex: number): Buffer {
  if (localIndex >= 0 && localIndex <= 3) {
    return instruction(0xd4 + localIndex);
  }
  return instruction(0x63, [writeU30(localIndex)]);
}

function getRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function operandBytes(kind: Operand[0], value: number): Buffer {
  if (kind === "u30") {
    return writeU30(value);
  }
  if (kind === "s8") {
    return Buffer.from([value & 0xff]);
  }
  throw new PatchError(`Unsupported inserted operand kind ${kind}`);
}

function getLex(nameIndex: number): Buffer {
  return instruction(0x60, [writeU30(nameIndex)]);
}

function getProperty(nameIndex: number): Buffer {
  return instruction(0x66, [writeU30(nameIndex)]);
}

function callProperty(nameIndex: number, argCount: number): Buffer {
  return instruction(0x46, [writeU30(nameIndex), writeU30(argCount)]);
}

function buildClampPrefix(abc: ReturnType<typeof parseAbc>): Buffer {
  const mathName = getRequiredMultiname(abc, "Math");
  const minName = getRequiredMultiname(abc, "min");
  const maxName = getRequiredMultiname(abc, "max");
  const cameraName = getRequiredMultiname(abc, "Camera");
  const screenWidthName = getRequiredMultiname(abc, "SCREEN_WIDTH");
  const playScreenHeightName = getRequiredMultiname(abc, "PLAY_SCREEN_HEIGHT");

  return Buffer.concat([
    getLex(mathName),
    getLocal(1),
    pushShort(MAX_DAMAGE_TEXT),
    callProperty(minName, 2),
    instruction(0x73),
    setLocal(1),

    getLex(mathName),
    pushByte(FLOATER_MARGIN),
    getLex(mathName),
    getLocal(2),
    getLex(cameraName),
    getProperty(screenWidthName),
    pushByte(FLOATER_MARGIN),
    instruction(0xa1),
    callProperty(minName, 2),
    callProperty(maxName, 2),
    instruction(0x75),
    setLocal(2),

    getLex(mathName),
    pushByte(FLOATER_MARGIN),
    getLex(mathName),
    getLocal(3),
    getLocal(12),
    instruction(0xa1),
    getLex(cameraName),
    getProperty(playScreenHeightName),
    pushByte(FLOATER_MARGIN),
    instruction(0xa1),
    callProperty(minName, 2),
    callProperty(maxName, 2),
    instruction(0x75),
    setLocal(3),
  ]);
}

function isBranchOpcode(opcode: number): boolean {
  return opcode >= 0x0c && opcode <= 0x1a;
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

function getGameMethod527(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Game");
  if (classIndex === null) {
    throw new PatchError(`Could not find Game class in ${swfPath}.`);
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_527");
  if (methodIdx === null) {
    throw new PatchError(`Could not find Game.method_527 in ${swfPath}.`);
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find body for Game.method_527 (${methodIdx}) in ${swfPath}.`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Game.method_527:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function buildPatchedMethod527Code(sourceSwfPath: string, targetAbc: ReturnType<typeof parseAbc>): Buffer {
  if (!fs.existsSync(sourceSwfPath)) {
    throw new PatchError(`Source SWF not found: ${sourceSwfPath}`);
  }

  const { abc: sourceAbc, code, instructions } = getGameMethod527(sourceSwfPath);
  const constructor = instructions.find(
    (inst) =>
      inst.opcode === 0x4a &&
      u30OperandName(inst, sourceAbc.multinameNames) === "class_72" &&
      inst.operands[1]?.[1] === 10,
  );
  if (!constructor) {
    throw new PatchError(`Source Game.method_527 does not create class_72 floaters.`);
  }

  const yOffsetLocal = instructions.find((inst) => inst.offset === constructor.offset - 12);
  if (
    !yOffsetLocal ||
    yOffsetLocal.opcode !== 0x62 ||
    yOffsetLocal.operands[0]?.[1] !== 12 ||
    code[constructor.offset - 10] !== 0xa1
  ) {
    throw new PatchError(`Source Game.method_527 constructor y-offset pattern not found.`);
  }

  return applyCodeEditsAndAdjustBranches(code, instructions, [
    {
      start: constructor.offset - 26,
      end: constructor.offset - 26,
      data: buildClampPrefix(targetAbc),
    },
    {
      start: constructor.offset - 12,
      end: constructor.offset - 9,
      data: Buffer.from([0x02, 0x02, 0x02]),
    },
  ]);
}

function method527HasClamp(code: Buffer, instructions: Instruction[], names: string[]): boolean {
  const hasFloater = instructions.some(
    (inst) => inst.opcode === 0x4a && u30OperandName(inst, names) === "class_72" && inst.operands[1]?.[1] === 10,
  );
  const hasDamageLimit = instructions.some((inst) => inst.opcode === 0x25 && inst.operands[0]?.[1] === MAX_DAMAGE_TEXT);
  const usesMathClamp =
    instructions.filter((inst) => inst.opcode === 0x46 && u30OperandName(inst, names) === "min").length >= 3 &&
    instructions.filter((inst) => inst.opcode === 0x46 && u30OperandName(inst, names) === "max").length >= 2;
  return hasFloater && hasDamageLimit && usesMathClamp && code.length > 1;
}

function patchSwf(swfPath: string, sourceSwfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getGameMethod527(swfPath);
  if (method527HasClamp(code, instructions, abc.multinameNames)) {
    console.log(`${swfPath}: already patched (Game.method_527 floaters restored and clamped).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_527 floaters are not restored/clamped.`);
  }

  const patchedCode = buildPatchedMethod527Code(sourceSwfPath, abc);
  const patches: BytePatch[] = [
    {
      key: "Game.method_527.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "restore and clamp damage floater body",
    },
    {
      key: "Game.method_527.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update Game.method_527 code length",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Game.method_527 floaters restored and clamped.`);
}

const { swfPath, sourceSwfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, sourceSwfPath, verify);
