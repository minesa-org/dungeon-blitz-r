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
  ensureBackup,
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
const REQUIRED_MAX_STACK = 2;

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-room-viewport-resync.ts [--verify] [--swf <path>]",
        "",
        "Marks Main.method_561 dirty after level construction completes so",
        "room transitions reapply the padded direct-SWF viewport without resizing.",
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

function getProperty(name: number): Buffer {
  return op(0x66, writeU30(name));
}

function setProperty(name: number): Buffer {
  return op(0x61, writeU30(name));
}

function getLex(name: number): Buffer {
  return op(0x5d, writeU30(name));
}

function callProperty(name: number, argCount: number): Buffer {
  return op(0x46, writeU30(name), writeU30(argCount));
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Could not find multiname ${name}.`);
  }
  return index;
}

function getGameMethod1445(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Game");
  if (classIndex === null) {
    throw new PatchError("Could not find Game class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1445");
  if (methodIdx === null) {
    throw new PatchError("Could not find Game.method_1445.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find body for Game.method_1445 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Game.method_1445:${methodIdx}`);
  return { ctx, abc, methodBody, instructions };
}

function buildDirtyResizeFlagPatch(abc: ReturnType<typeof parseAbc>): Buffer {
  const main = findRequiredMultiname(abc, "main");
  const getTimer = findRequiredMultiname(abc, "getTimer");
  const var2289 = findRequiredMultiname(abc, "var_2289");

  return Buffer.concat([
    op(0xd0),
    getProperty(main),
    getLex(getTimer),
    callProperty(getTimer, 0),
    setProperty(var2289),
  ]);
}

function hasRoomViewportResync(instructions: Instruction[], names: string[]): boolean {
  return instructions.some((instruction) =>
    instruction.opcode === 0x61 &&
    u30OperandName(instruction, names) === "var_2289"
  );
}

function findMethod1453CallEnd(instructions: Instruction[], names: string[]): number {
  const instruction = instructions.find((candidate) =>
    candidate.opcode === 0x4f &&
    u30OperandName(candidate, names) === "method_1453"
  );
  if (!instruction) {
    throw new PatchError("Could not find Game.method_1445 method_1453 call.");
  }
  return instruction.offset + instruction.size;
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, instructions } = getGameMethod1445(swfPath);
  if (hasRoomViewportResync(instructions, abc.multinameNames)) {
    console.log(`${swfPath}: already patched (room viewport resync dirty flag present).`);
    return;
  }
  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1445 does not mark Main.method_561 dirty after level construction.`);
  }

  const dirtyFlagPatch = buildDirtyResizeFlagPatch(abc);
  const insertionOffset = findMethod1453CallEnd(instructions, abc.multinameNames);
  const [maxStack] = readU30(ctx.body, methodBody.maxStackPos, "Game.method_1445.max_stack");
  const patches: BytePatch[] = [];

  if (maxStack < REQUIRED_MAX_STACK) {
    patches.push({
      key: "Game.method_1445.maxStack",
      start: methodBody.maxStackPos,
      end: methodBody.localCountPos,
      data: writeU30(REQUIRED_MAX_STACK),
      detail: `raise max_stack to ${REQUIRED_MAX_STACK} for viewport resync dirty flag`,
    });
  }
  patches.push({
    key: "Game.method_1445.codeLen",
    start: methodBody.codeLenPos,
    end: methodBody.codeStart,
    data: writeU30(methodBody.codeLen + dirtyFlagPatch.length),
    detail: "extend Game.method_1445 for room viewport resync",
  });
  patches.push({
    key: "Game.method_1445.viewportResyncDirtyFlag",
    start: methodBody.codeStart + insertionOffset,
    end: methodBody.codeStart + insertionOffset,
    data: dirtyFlagPatch,
    detail: "mark Main.method_561 dirty after level construction completes",
  });

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Game.method_1445 room viewport resync.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
