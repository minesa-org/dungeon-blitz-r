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

function resolveDefaultSwf(): string {
  const candidates = [
    path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
    path.resolve(__dirname, "..", "..", "..", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
    path.resolve(process.cwd(), "src", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

type Operand = [Instruction["operands"][number][0], number];

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-game-method1970-entity-update-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches Game.method_1970 so Entity.method_1770 update errors",
        "remove the broken entity instead of crashing the client.",
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

function getLocalOperand(instruction: Instruction | undefined): number | null {
  if (!instruction) {
    return null;
  }
  if (instruction.opcode >= 0xd0 && instruction.opcode <= 0xd3) {
    return instruction.opcode - 0xd0;
  }
  if (instruction.opcode === 0x62 && instruction.operands[0]?.[0] === "u30") {
    return instruction.operands[0][1];
  }
  return null;
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function getGameMethod1970(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Game");
  if (classIndex === null) {
    throw new PatchError("Game class not found.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1970");
  if (methodIdx === null) {
    throw new PatchError("Game.method_1970 not found.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Game.method_1970 body not found (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Game.method_1970:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function findEntityUpdateTryRange(instructions: Instruction[], abc: ReturnType<typeof parseAbc>) {
  for (let index = 1; index < instructions.length - 2; index += 1) {
    const call = instructions[index];
    if (
      call.opcode !== 0x46 ||
      u30OperandName(call, abc.multinameNames) !== "method_1770" ||
      call.operands[1]?.[1] !== 0
    ) {
      continue;
    }

    const receiver = instructions[index - 1];
    const continuation = instructions[index + 1];
    if (getLocalOperand(receiver) === 2) {
      return {
        from: receiver.offset,
        to: call.offset + call.size,
        continuation: continuation.offset,
      };
    }
  }

  throw new PatchError("Could not find Game.method_1970 Entity.method_1770 call.");
}

function buildCatchHandler(
  clientEntName: number,
  destroyEntityName: number,
  entitiesName: number,
  spliceName: number,
): Buffer {
  const prefix = Buffer.concat([
    opcode(0xd0), // getlocal0
    opcode(0x30), // pushscope
    opcode(0x5a, [["u30", 0]]), // newcatch 0
    opcode(0x2a), // dup
    opcode(0x63, [["u30", 14]]), // setlocal 14
    opcode(0x2a), // dup
    opcode(0x30), // pushscope
    opcode(0x2b), // swap
    opcode(0x6d, [["u30", 1]]), // setslot 1
    opcode(0x1d), // popscope
    opcode(0x08, [["u30", 14]]), // kill 14
    opcode(0xd2), // getlocal2
    opcode(0xd0), // getlocal0
    opcode(0x66, [["u30", clientEntName]]), // clientEnt
    opcode(0xab), // equals
  ]);
  const branch = opcode(0x12, [["s24", 0]]); // iffalse destroy
  const keepClient = opcode(0x47); // returnvoid
  const destroy = Buffer.concat([
    opcode(0xd2), // getlocal2
    opcode(0x26), // pushtrue
    opcode(0x4f, [["u30", destroyEntityName], ["u30", 1]]), // DestroyEntity(true)
    opcode(0xd0), // getlocal0
    opcode(0x66, [["u30", entitiesName]]), // entities
    opcode(0xd1), // getlocal1
    opcode(0x24, [["s8", 1]]), // remove one entity
    opcode(0x4f, [["u30", spliceName], ["u30", 2]]), // entities.splice(_loc1_, 1)
    opcode(0x47), // returnvoid
  ]);
  const branchOffset = prefix.length;
  const destroyOffset = prefix.length + branch.length + keepClient.length;
  const patchedBranch = opcode(0x12, [["s24", destroyOffset - (branchOffset + branch.length)]]);
  return Buffer.concat([prefix, patchedBranch, keepClient, destroy]);
}

function hasCrashGuard(swfPath: string): boolean {
  const { abc, methodBody, instructions } = getGameMethod1970(swfPath);
  const range = findEntityUpdateTryRange(instructions, abc);
  const errorName = findRequiredMultiname(abc, "Error");
  const clientEntName = findRequiredMultiname(abc, "clientEnt");
  const destroyEntityName = findRequiredMultiname(abc, "DestroyEntity");
  const spliceName = findRequiredMultiname(abc, "splice");
  return methodBody.exceptions.some((entry) =>
    entry.from === range.from &&
    entry.to === range.to &&
    entry.type === errorName &&
    entry.target >= range.to &&
    entry.target < methodBody.codeLen &&
    instructions.some((instruction) =>
      instruction.offset > entry.target &&
      instruction.opcode === 0x66 &&
      instruction.operands[0]?.[1] === clientEntName
    ) &&
    instructions.some((instruction) =>
      instruction.offset > entry.target &&
      instruction.opcode === 0x4f &&
      instruction.operands[0]?.[1] === destroyEntityName
    ) &&
    instructions.some((instruction) =>
      instruction.offset > entry.target &&
      instruction.opcode === 0x4f &&
      instruction.operands[0]?.[1] === spliceName
    )
  );
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getGameMethod1970(swfPath);
  const range = findEntityUpdateTryRange(instructions, abc);
  const errorName = findRequiredMultiname(abc, "Error");
  const catchName = findRequiredMultiname(abc, "error");
  const clientEntName = findRequiredMultiname(abc, "clientEnt");
  const destroyEntityName = findRequiredMultiname(abc, "DestroyEntity");
  const entitiesName = findRequiredMultiname(abc, "entities");
  const spliceName = findRequiredMultiname(abc, "splice");

  const existingGuard = methodBody.exceptions.find((entry) =>
    entry.from === range.from &&
    entry.to === range.to &&
    entry.type === errorName &&
    entry.target >= range.to &&
    entry.target < methodBody.codeLen
  );

  if (existingGuard && hasCrashGuard(swfPath)) {
    console.log(`${swfPath}: already patched (Game.method_1970 entity update crash guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1970 entity update crash guard is missing.`);
  }

  if (methodBody.exceptionCount !== 0 && !existingGuard) {
    throw new PatchError("Game.method_1970 already has unexpected exception handlers.");
  }

  const handlerOffset = existingGuard?.target ?? code.length;
  const handler = buildCatchHandler(clientEntName, destroyEntityName, entitiesName, spliceName);
  const patchedCode = existingGuard
    ? Buffer.concat([code.subarray(0, handlerOffset), handler])
    : Buffer.concat([code, handler]);
  const exceptionTable = existingGuard
    ? Buffer.concat([
        writeU30(1),
        writeU30(range.from),
        writeU30(range.to),
        writeU30(handlerOffset),
        writeU30(errorName),
        writeU30(catchName),
      ])
    : Buffer.concat([
        writeU30(1),
        writeU30(range.from),
        writeU30(range.to),
        writeU30(code.length),
        writeU30(errorName),
        writeU30(catchName),
      ]);

  const patches: BytePatch[] = [
    {
      key: "Game.method_1970.localCount",
      start: methodBody.localCountPos,
      end: methodBody.localCountPos + writeU30(14).length,
      data: writeU30(15),
      detail: "add catch local",
    },
    {
      key: "Game.method_1970.maxScopeDepth",
      start: methodBody.maxScopeDepthPos,
      end: methodBody.codeLenPos,
      data: writeU30(Math.max(methodBody.maxScopeDepth, 6)),
      detail: "allow catch scope",
    },
    {
      key: "Game.method_1970.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "append entity update catch handler",
    },
    {
      key: "Game.method_1970.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update method_1970 code length",
    },
    {
      key: "Game.method_1970.exceptionTable",
      start: methodBody.exceptionCountPos,
      end: methodBody.traitsCountPos,
      data: exceptionTable,
      detail: "catch entity update errors",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Game.method_1970 entity update crash guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
if (verify) {
  if (!hasCrashGuard(swfPath)) {
    throw new PatchError(`${swfPath}: verify failed; Game.method_1970 entity update crash guard is missing.`);
  }
  console.log(`${swfPath}: verified Game.method_1970 entity update crash guard.`);
} else {
  patchSwf(swfPath, false);
}
