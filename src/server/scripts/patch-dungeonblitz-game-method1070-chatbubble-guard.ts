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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-game-method1070-chatbubble-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches Game.method_1070 so ChatBubble.method_901 update errors",
        "invalidate the broken bubble instead of crashing the client.",
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

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function getGameMethod1070(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Game");
  if (classIndex === null) {
    throw new PatchError("Game class not found.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1070");
  if (methodIdx === null) {
    throw new PatchError("Game.method_1070 not found.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Game.method_1070 body not found (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Game.method_1070:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function findChatBubbleUpdateRange(instructions: Instruction[], abc: ReturnType<typeof parseAbc>) {
  for (let index = 1; index < instructions.length; index += 1) {
    const call = instructions[index];
    if (
      call.opcode === 0x4f &&
      u30OperandName(call, abc.multinameNames) === "method_901" &&
      call.operands[1]?.[1] === 0 &&
      instructions[index - 1]?.opcode === 0xd1
    ) {
      return {
        from: instructions[index - 1].offset,
        to: call.offset + call.size,
      };
    }
  }

  throw new PatchError("Could not find Game.method_1070 ChatBubble.method_901 call.");
}

function buildCatchHandler(catchLocal: number, validName: number): Buffer {
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
    opcode(0xd1), // current ChatBubble
    opcode(0x27), // pushfalse
    opcode(0x61, [["u30", validName]]), // bIAmValid = false
    opcode(0x47), // returnvoid
  ]);
}

function hasCrashGuard(swfPath: string): boolean {
  const { abc, methodBody, instructions } = getGameMethod1070(swfPath);
  const range = findChatBubbleUpdateRange(instructions, abc);
  const errorName = findRequiredMultiname(abc, "Error");
  const validName = findRequiredMultiname(abc, "bIAmValid");

  return methodBody.exceptions.some((entry) =>
    entry.from === range.from &&
    entry.to === range.to &&
    entry.type === errorName &&
    entry.target >= range.to &&
    entry.target < methodBody.codeLen &&
    instructions.some((instruction) =>
      instruction.offset > entry.target &&
      instruction.opcode === 0x61 &&
      instruction.operands[0]?.[1] === validName
    )
  );
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getGameMethod1070(swfPath);
  const range = findChatBubbleUpdateRange(instructions, abc);
  const errorName = findRequiredMultiname(abc, "Error");
  const catchName = findRequiredMultiname(abc, "error");
  const validName = findRequiredMultiname(abc, "bIAmValid");
  const [localCount, localCountEnd] = readU30(ctx.body, methodBody.localCountPos, "Game.method_1070.local_count");
  const catchLocal = localCount;

  if (hasCrashGuard(swfPath)) {
    console.log(`${swfPath}: already patched (Game.method_1070 ChatBubble crash guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1070 ChatBubble crash guard is missing.`);
  }

  if (methodBody.exceptionCount !== 0) {
    throw new PatchError("Game.method_1070 already has unexpected exception handlers.");
  }

  const handler = buildCatchHandler(catchLocal, validName);
  const patchedCode = Buffer.concat([code, handler]);
  const exceptionTable = Buffer.concat([
    writeU30(1),
    writeU30(range.from),
    writeU30(range.to),
    writeU30(code.length),
    writeU30(errorName),
    writeU30(catchName),
  ]);

  const patches: BytePatch[] = [
    {
      key: "Game.method_1070.localCount",
      start: methodBody.localCountPos,
      end: localCountEnd,
      data: writeU30(localCount + 1),
      detail: "add catch local",
    },
    {
      key: "Game.method_1070.maxScopeDepth",
      start: methodBody.maxScopeDepthPos,
      end: methodBody.codeLenPos,
      data: writeU30(Math.max(methodBody.maxScopeDepth, 6)),
      detail: "allow catch scope",
    },
    {
      key: "Game.method_1070.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "append ChatBubble update catch handler",
    },
    {
      key: "Game.method_1070.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update Game.method_1070 code length",
    },
    {
      key: "Game.method_1070.exceptionTable",
      start: methodBody.exceptionCountPos,
      end: methodBody.traitsCountPos,
      data: exceptionTable,
      detail: "catch ChatBubble update errors",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Game.method_1070 ChatBubble crash guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
if (verify) {
  if (!hasCrashGuard(swfPath)) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1070 ChatBubble crash guard is missing.`);
  }
  console.log(`${swfPath}: verified Game.method_1070 ChatBubble crash guard.`);
} else {
  patchSwf(swfPath, false);
}
