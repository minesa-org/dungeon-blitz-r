import * as path from "path";
import {
  applyPatchesToBody,
  BytePatch,
  classIndexByName,
  ensureBackup,
  methodIdxForTrait,
  parseAbc,
  parseSwf,
  PatchError,
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

const INSERT_OFFSET = 22;
const VIPER_POISON_BUFF_ID = 740;
const VIPER_BLEED_BUFF_ID = 741;

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-viperblade-buff-reapply-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches CombatState.AddBuff so Viperblade's one-stack poison/bleed buffs",
        "are ignored while already active, preserving the original 5 second window.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function writeS24(value: number): Buffer {
  const normalized = value < 0 ? 0x1000000 + value : value;
  if (normalized < 0 || normalized > 0xffffff) {
    throw new PatchError(`s24 out of range: ${value}`);
  }
  return Buffer.from([normalized & 0xff, (normalized >> 8) & 0xff, (normalized >> 16) & 0xff]);
}

function opU30(opcode: number, value: number): Buffer {
  return Buffer.concat([Buffer.from([opcode]), writeU30(value)]);
}

function opU30U30(opcode: number, first: number, second: number): Buffer {
  return Buffer.concat([Buffer.from([opcode]), writeU30(first), writeU30(second)]);
}

function branch(opcode: number, fromOffset: number, targetOffset: number): Buffer {
  return Buffer.concat([Buffer.from([opcode]), writeS24(targetOffset - (fromOffset + 4))]);
}

function getCombatStateAddBuff(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "CombatState");
  if (classIndex === null) {
    throw new PatchError("Could not find CombatState class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "AddBuff");
  if (methodIdx === null) {
    throw new PatchError("Could not find CombatState.AddBuff.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for CombatState.AddBuff (${methodIdx}).`);
  }
  if (methodBody.exceptionCount !== 0) {
    throw new PatchError("CombatState.AddBuff has an unexpected exception table.");
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  return { ctx, abc, methodBody, code };
}

function getRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function buildGuard(abc: ReturnType<typeof parseAbc>): Buffer {
  const buffIdName = getRequiredMultiname(abc, "buffID");
  const method135Name = getRequiredMultiname(abc, "method_135");
  const chunks: Buffer[] = [];
  let offset = 0;

  const emit = (buffer: Buffer): number => {
    const start = offset;
    chunks.push(buffer);
    offset += buffer.length;
    return start;
  };

  emit(Buffer.from([0xd1])); // getlocal1: BuffType param1
  emit(opU30(0x66, buffIdName)); // getproperty buffID
  emit(opU30(0x25, VIPER_POISON_BUFF_ID)); // pushshort 740
  emit(Buffer.from([0xab])); // equals
  const poisonBranch = emit(Buffer.alloc(4));
  emit(Buffer.from([0xd0, 0xd1])); // this, param1
  emit(opU30U30(0x46, method135Name, 1)); // callproperty method_135, 1
  const poisonActiveBranch = emit(Buffer.alloc(4));
  emit(Buffer.from([0x47])); // returnvoid

  const bleedCheckOffset = offset;
  emit(Buffer.from([0xd1]));
  emit(opU30(0x66, buffIdName));
  emit(opU30(0x25, VIPER_BLEED_BUFF_ID));
  emit(Buffer.from([0xab]));
  const bleedBranch = emit(Buffer.alloc(4));
  emit(Buffer.from([0xd0, 0xd1]));
  emit(opU30U30(0x46, method135Name, 1));
  const bleedActiveBranch = emit(Buffer.alloc(4));
  emit(Buffer.from([0x47]));

  const continueOffset = offset;
  chunks[chunks.findIndex((_, index) => {
    let cursor = 0;
    for (let i = 0; i < index; i += 1) {
      cursor += chunks[i].length;
    }
    return cursor === poisonBranch;
  })] = branch(0x12, poisonBranch, bleedCheckOffset);
  chunks[chunks.findIndex((_, index) => {
    let cursor = 0;
    for (let i = 0; i < index; i += 1) {
      cursor += chunks[i].length;
    }
    return cursor === poisonActiveBranch;
  })] = branch(0x12, poisonActiveBranch, bleedCheckOffset);
  chunks[chunks.findIndex((_, index) => {
    let cursor = 0;
    for (let i = 0; i < index; i += 1) {
      cursor += chunks[i].length;
    }
    return cursor === bleedBranch;
  })] = branch(0x12, bleedBranch, continueOffset);
  chunks[chunks.findIndex((_, index) => {
    let cursor = 0;
    for (let i = 0; i < index; i += 1) {
      cursor += chunks[i].length;
    }
    return cursor === bleedActiveBranch;
  })] = branch(0x12, bleedActiveBranch, continueOffset);

  return Buffer.concat(chunks);
}

export function hasViperbladeBuffReapplyGuard(swfPath: string): boolean {
  const { abc, code } = getCombatStateAddBuff(swfPath);
  const guard = buildGuard(abc);
  return code.subarray(INSERT_OFFSET, INSERT_OFFSET + guard.length).equals(guard);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code } = getCombatStateAddBuff(swfPath);
  const guard = buildGuard(abc);

  if (code.subarray(INSERT_OFFSET, INSERT_OFFSET + guard.length).equals(guard)) {
    console.log(`${swfPath}: already patched (Viperblade buff reapply guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Viperblade buff reapply guard is missing.`);
  }

  const patchedCode = Buffer.concat([
    code.subarray(0, INSERT_OFFSET),
    guard,
    code.subarray(INSERT_OFFSET),
  ]);
  const patches: BytePatch[] = [
    {
      key: "CombatState.AddBuff.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "skip Viperblade poison/bleed reapplication while already active",
    },
    {
      key: "CombatState.AddBuff.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update CombatState.AddBuff code length",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched Viperblade buff reapply guard.`);
}

if (require.main === module) {
  const { swfPath, verify } = parseArgs(process.argv);
  patchSwf(swfPath, verify);
}
