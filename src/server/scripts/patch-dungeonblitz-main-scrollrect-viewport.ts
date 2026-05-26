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
const REQUIRED_MAX_STACK = 7;
const VIEWPORT_PADDING_LEFT = 21;
const VIEWPORT_PADDING_TOP = 31;
const VIEWPORT_PADDING_RIGHT = 31;
const VIEWPORT_PADDING_BOTTOM = 90;
const VIEWPORT_PADDING_HORIZONTAL = VIEWPORT_PADDING_LEFT + VIEWPORT_PADDING_RIGHT;
const VIEWPORT_PADDING_VERTICAL = VIEWPORT_PADDING_TOP + VIEWPORT_PADDING_BOTTOM;

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-main-scrollrect-viewport.ts [--verify] [--swf <path>]",
        "",
        "Adds a Main.scrollRect clip matching the scaled 1152x768 game viewport",
        "so direct SWF playback cannot draw room art below the UI.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function op(opcode: number, ...operands: Buffer[]): Buffer {
  return Buffer.concat([Buffer.from([opcode]), ...operands]);
}

function pushByte(value: number): Buffer {
  return op(0x24, Buffer.from([value & 0xff]));
}

function pushInt(value: number): Buffer {
  if (value >= -128 && value <= 127) {
    return pushByte(value);
  }
  return op(0x25, writeU30(value));
}

function nops(count: number): Buffer {
  return Buffer.alloc(count, 0x02);
}

function getLex(name: number): Buffer {
  return op(0x60, writeU30(name));
}

function getProperty(name: number): Buffer {
  return op(0x66, writeU30(name));
}

function setProperty(name: number): Buffer {
  return op(0x61, writeU30(name));
}

function constructProperty(name: number, argCount: number): Buffer {
  return op(0x4a, writeU30(name), writeU30(argCount));
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Could not find multiname ${name}.`);
  }
  return index;
}

function getMainMethod561(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Main");
  if (classIndex === null) {
    throw new PatchError("Could not find Main class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_561");
  if (methodIdx === null) {
    throw new PatchError("Could not find Main.method_561.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for Main.method_561 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Main.method_561:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function hasMainScrollRectPatch(instructions: Instruction[], names: string[]): boolean {
  return instructions.some((instruction, index) =>
    instruction.opcode === 0x4a &&
    u30OperandName(instruction, names) === "Rectangle" &&
    instruction.operands[1]?.[1] === 4 &&
    instructions[index + 1]?.opcode === 0x61 &&
    u30OperandName(instructions[index + 1], names) === "scrollRect"
  );
}

function findExistingScrollRectPatchBounds(instructions: Instruction[], names: string[]): { start: number; end: number } | null {
  const constructIndex = instructions.findIndex((instruction, index) =>
    instruction.opcode === 0x4a &&
    u30OperandName(instruction, names) === "Rectangle" &&
    instruction.operands[1]?.[1] === 4 &&
    instructions[index + 1]?.opcode === 0x61 &&
    u30OperandName(instructions[index + 1], names) === "scrollRect"
  );
  if (constructIndex === -1) {
    return null;
  }

  for (let index = constructIndex - 1; index >= 0; index -= 1) {
    const setY = instructions[index];
    if (
      setY.opcode === 0x61 &&
      u30OperandName(setY, names) === "y"
    ) {
      const setScrollRect = instructions[constructIndex + 1];
      return { start: setY.offset + setY.size, end: setScrollRect.offset + setScrollRect.size };
    }
  }
  return null;
}

function hasRequiredMaxStack(ctx: ReturnType<typeof parseSwf>, methodBody: ReturnType<typeof getMainMethod561>["methodBody"]): boolean {
  return ctx.body
    .subarray(methodBody.maxStackPos, methodBody.localCountPos)
    .equals(writeU30(REQUIRED_MAX_STACK));
}

function fitPaddingInstructionData(value: number, targetLength: number): Buffer {
  const literal = pushInt(value);
  if (literal.length > targetLength) {
    throw new PatchError(`Fit padding literal is too large for fixed-width replacement: ${value}`);
  }
  return Buffer.concat([literal, nops(targetLength - literal.length)]);
}

function isPaddingLiteral(instruction: Instruction | undefined): boolean {
  return instruction?.opcode === 0x24 || instruction?.opcode === 0x25;
}

function findFitPaddingBounds(
  instructions: Instruction[],
  names: string[],
  dimensionName: "SCREEN_WIDTH" | "SCREEN_HEIGHT",
): { start: number; end: number; value: number | null } | null {
  for (let index = 0; index < instructions.length - 6; index += 1) {
    const dimension = instructions[index];
    if (dimension.opcode !== 0x66 || u30OperandName(dimension, names) !== dimensionName) {
      continue;
    }

    const current = instructions[index + 1];
    if (isPaddingLiteral(current)) {
      let cursor = index + 2;
      while (instructions[cursor]?.opcode === 0x02) {
        cursor += 1;
      }
      if (
        instructions[cursor]?.opcode === 0xa0 &&
        instructions[cursor + 1]?.opcode === 0xa3
      ) {
        return { start: current.offset, end: instructions[cursor].offset, value: current.operands[0]?.[1] ?? null };
      }
    }

    const afterCurrent = instructions[index + 2];
    if (
      current?.opcode === 0x60 &&
      u30OperandName(current, names) === "var_1876" &&
      afterCurrent?.opcode === 0x24 &&
      afterCurrent.operands[0]?.[1] === 2 &&
      instructions[index + 3]?.opcode === 0xa2 &&
      instructions[index + 4]?.opcode === 0xa0 &&
      instructions[index + 5]?.opcode === 0xa3
    ) {
      return { start: current.offset, end: instructions[index + 4].offset, value: null };
    }
  }

  return null;
}

function buildFitPaddingPatches(
  methodBody: ReturnType<typeof getMainMethod561>["methodBody"],
  instructions: Instruction[],
  names: string[],
): BytePatch[] {
  const patches: BytePatch[] = [];
  const widthBounds = findFitPaddingBounds(instructions, names, "SCREEN_WIDTH");
  const heightBounds = findFitPaddingBounds(instructions, names, "SCREEN_HEIGHT");
  if (!widthBounds || !heightBounds) {
    throw new PatchError("Could not find Main.method_561 fit padding calculation.");
  }

  if (widthBounds.value !== VIEWPORT_PADDING_HORIZONTAL) {
    patches.push({
      key: "Main.method_561.fitWidthPadding",
      start: methodBody.codeStart + widthBounds.start,
      end: methodBody.codeStart + widthBounds.end,
      data: fitPaddingInstructionData(VIEWPORT_PADDING_HORIZONTAL, widthBounds.end - widthBounds.start),
      detail: `fit width against ${VIEWPORT_PADDING_HORIZONTAL}px total viewport padding`,
    });
  }
  if (heightBounds.value !== VIEWPORT_PADDING_VERTICAL) {
    patches.push({
      key: "Main.method_561.fitHeightPadding",
      start: methodBody.codeStart + heightBounds.start,
      end: methodBody.codeStart + heightBounds.end,
      data: fitPaddingInstructionData(VIEWPORT_PADDING_VERTICAL, heightBounds.end - heightBounds.start),
      detail: `fit height against ${VIEWPORT_PADDING_VERTICAL}px total viewport padding`,
    });
  }

  return patches;
}

function findScrollRectInsertionOffset(instructions: Instruction[], names: string[]): number {
  for (let index = 0; index < instructions.length - 4; index += 1) {
    const setY = instructions[index];
    const nextThis = instructions[index + 1];
    const nextThisAgain = instructions[index + 2];
    const getFrameTime = instructions[index + 3];
    const setFrameTime = instructions[index + 4];

    if (
      setY.opcode === 0x61 &&
      u30OperandName(setY, names) === "y" &&
      nextThis?.opcode === 0xd0 &&
      nextThisAgain?.opcode === 0xd0 &&
      getFrameTime?.opcode === 0x66 &&
      u30OperandName(getFrameTime, names) === "var_2289" &&
      setFrameTime?.opcode === 0x61 &&
      u30OperandName(setFrameTime, names) === "var_2792"
    ) {
      return setY.offset + setY.size;
    }
  }

  throw new PatchError("Could not find Main.method_561 insertion point after parent.y assignment.");
}

function buildScrollRectPatch(abc: ReturnType<typeof parseAbc>): Buffer {
  const rectangle = findRequiredMultiname(abc, "Rectangle");
  const scrollRect = findRequiredMultiname(abc, "scrollRect");
  const camera = findRequiredMultiname(abc, "Camera");
  const screenWidth = findRequiredMultiname(abc, "SCREEN_WIDTH");
  const screenHeight = findRequiredMultiname(abc, "SCREEN_HEIGHT");
  const overallScale = findRequiredMultiname(abc, "overallScale");

  return Buffer.concat([
    op(0xd0),
    op(0x5d, writeU30(rectangle)),
    pushInt(-VIEWPORT_PADDING_LEFT),
    op(0xd0),
    getProperty(overallScale),
    op(0xa2),
    pushInt(-VIEWPORT_PADDING_TOP),
    op(0xd0),
    getProperty(overallScale),
    op(0xa2),
    getLex(camera),
    getProperty(screenWidth),
    pushInt(VIEWPORT_PADDING_HORIZONTAL),
    op(0xa0),
    op(0xd0),
    getProperty(overallScale),
    op(0xa2),
    getLex(camera),
    getProperty(screenHeight),
    pushInt(VIEWPORT_PADDING_VERTICAL),
    op(0xa0),
    op(0xd0),
    getProperty(overallScale),
    op(0xa2),
    constructProperty(rectangle, 4),
    setProperty(scrollRect),
  ]);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, instructions, code } = getMainMethod561(swfPath);
  const insertion = buildScrollRectPatch(abc);
  const fitPaddingPatches = buildFitPaddingPatches(methodBody, instructions, abc.multinameNames);

  if (hasMainScrollRectPatch(instructions, abc.multinameNames)) {
    const existingBounds = findExistingScrollRectPatchBounds(instructions, abc.multinameNames);
    if (!existingBounds) {
      throw new PatchError(`${swfPath}: Main.method_561 scrollRect patch bounds could not be found.`);
    }

    const existingPatch = code.subarray(existingBounds.start, existingBounds.end);
    if (existingPatch.equals(insertion) && hasRequiredMaxStack(ctx, methodBody) && fitPaddingPatches.length === 0) {
      console.log(`${swfPath}: already patched (Main.method_561 scrollRect viewport clip present).`);
      return;
    }
    if (verify) {
      throw new PatchError(`${swfPath}: verify failed; Main.method_561 scrollRect clip needs the padded viewport patch.`);
    }

    const codeDelta = insertion.length - existingPatch.length;
    ensureBackup(swfPath);
    const { body, delta: swfDelta } = applyPatchesToBody(ctx.body, [
      {
        key: "Main.method_561.maxStack",
        start: methodBody.maxStackPos,
        end: methodBody.localCountPos,
        data: writeU30(REQUIRED_MAX_STACK),
        detail: `raise max_stack to ${REQUIRED_MAX_STACK} for Rectangle viewport clip construction`,
      },
      {
        key: "Main.method_561.codeLen",
        start: methodBody.codeLenPos,
        end: methodBody.codeStart,
        data: writeU30(methodBody.codeLen + codeDelta),
        detail: "adjust Main.method_561 code length for padded scrollRect clip",
      },
      {
        key: "Main.method_561.scrollRect",
        start: methodBody.codeStart + existingBounds.start,
        end: methodBody.codeStart + existingBounds.end,
        data: insertion,
        detail: "clip Main display list to a padded 1152x768 game viewport",
      },
      ...fitPaddingPatches,
    ]);
    writeSwf(ctx, body, swfDelta);
    console.log(`${swfPath}: repaired Main.method_561 padded scrollRect viewport clip.`);
    return;
  }
  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Main.method_561 scrollRect viewport clip is missing.`);
  }

  const insertionOffset = findScrollRectInsertionOffset(instructions, abc.multinameNames);
  const patches: BytePatch[] = [
    {
      key: "Main.method_561.maxStack",
      start: methodBody.maxStackPos,
      end: methodBody.localCountPos,
      data: writeU30(REQUIRED_MAX_STACK),
      detail: `raise max_stack to ${REQUIRED_MAX_STACK} for Rectangle viewport clip construction`,
    },
    {
      key: "Main.method_561.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(methodBody.codeLen + insertion.length),
      detail: "extend Main.method_561 code length for scrollRect clip",
    },
    {
      key: "Main.method_561.scrollRect",
      start: methodBody.codeStart + insertionOffset,
      end: methodBody.codeStart + insertionOffset,
      data: insertion,
      detail: "clip Main display list to the scaled 1152x768 game viewport",
    },
    ...fitPaddingPatches,
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Main.method_561 scrollRect viewport clip.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
