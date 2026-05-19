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
  return Buffer.from([value & 0xff]);
}

function opcode(op: number, operands: Operand[] = []): Buffer {
  return Buffer.concat([Buffer.from([op]), ...operands.map(([kind, value]) => operandBytes(kind, value))]);
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

  if (constructorArgsEnd <= constructorArgsStart) {
    throw new PatchError("Unexpected Game.method_1947 BitmapData argument range.");
  }

  if (isPatched(code, constructorArgsStart, constructorArgsEnd) && hasCrashGuard) {
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
  const [localCount, localCountEnd] = readU30(ctx.body, methodBody.localCountPos, "Game.method_1947.local_count");
  const handler = buildCatchHandler(localCount);
  const handlerOffset = code.length;
  const patchedCode = hasCrashGuard ? code : Buffer.concat([code, handler]);
  const exceptionTable = hasCrashGuard
    ? ctx.body.subarray(methodBody.exceptionCountPos, methodBody.traitsCountPos)
    : Buffer.concat([
        writeU30(1),
        writeU30(find.offset),
        writeU30(construct.offset + construct.size),
        writeU30(handlerOffset),
        writeU30(errorName),
        writeU30(catchName),
      ]);

  const patches: BytePatch[] = [
    {
      key: "Game.method_1947.screen_bitmap_dimensions",
      start: methodBody.codeStart + constructorArgsStart,
      end: methodBody.codeStart + constructorArgsEnd,
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
          {
            key: "Game.method_1947.code",
            start: methodBody.codeStart,
            end: methodBody.codeStart + methodBody.codeLen,
            data: patchedCode,
            detail: "append screen BitmapData catch handler",
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
