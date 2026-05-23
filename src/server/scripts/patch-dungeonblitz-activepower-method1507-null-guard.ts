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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-activepower-method1507-null-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches ActivePower.method_1507 so stale/null caster graphics during high-damage",
        "death ticks are ignored instead of crashing the Flash client.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function getActivePowerMethod1507(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "ActivePower");
  if (classIndex === null) {
    throw new PatchError("Could not find ActivePower class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1507");
  if (methodIdx === null) {
    throw new PatchError("Could not find ActivePower.method_1507.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for ActivePower.method_1507 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  return { ctx, methodBody, code };
}

function getRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found.`);
  }
  return index;
}

function method1507AlreadyPatched(
  methodBody: ReturnType<typeof getActivePowerMethod1507>["methodBody"],
  code: Buffer,
): boolean {
  return methodBody.exceptions.some((exception) => {
    if (exception.from !== 0) {
      return false;
    }
    const handler = code.subarray(exception.target);
    return (
      handler[0] === 0x29 &&
      handler.includes(0x68) &&
      handler[handler.length - 1] === 0x47
    );
  });
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

function buildCatchHandler(abc: ReturnType<typeof parseAbc>): Buffer {
  const var4Name = getRequiredMultiname(abc, "var_4");
  const var997Name = getRequiredMultiname(abc, "var_997");
  const beforeBranch = Buffer.concat([
    Buffer.from([0x29, 0xd0, 0x66]),
    writeU30(var4Name),
    Buffer.from([0x2a, 0x12, 0, 0, 0, 0x27, 0x68]),
    writeU30(var997Name),
    Buffer.from([0x47]),
  ]);
  const nullBranchOffset = beforeBranch.length;
  const nullBranch = Buffer.from([0x29, 0x47]);
  const handler = Buffer.concat([beforeBranch, nullBranch]);
  const branchOperandPos = 5 + writeU30(var4Name).length;
  writeS24(nullBranchOffset - (branchOperandPos + 3)).copy(handler, branchOperandPos);
  return handler;
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, methodBody, code } = getActivePowerMethod1507(swfPath);
  const abc = parseAbc(ctx);
  if (method1507AlreadyPatched(methodBody, code)) {
    console.log(`${swfPath}: already patched (ActivePower.method_1507 null guard present).`);
    return;
  }

  if (methodBody.exceptionCount > 1) {
    throw new PatchError(`${swfPath}: ActivePower.method_1507 has an unexpected exception table.`);
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; ActivePower.method_1507 null guard is missing.`);
  }

  const originalCode = methodBody.exceptionCount === 1 ? code.subarray(0, methodBody.exceptions[0].target) : code;
  const catchOffset = originalCode.length;
  const patchedCode = Buffer.concat([originalCode, buildCatchHandler(abc)]);
  const exceptionEntry = Buffer.concat([
    writeU30(0),
    writeU30(catchOffset),
    writeU30(catchOffset),
    writeU30(0),
    writeU30(0),
  ]);

  const patches: BytePatch[] = [
    {
      key: "ActivePower.method_1507.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "append null-reference catch handler",
    },
    {
      key: "ActivePower.method_1507.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update ActivePower.method_1507 code length",
    },
    {
      key: "ActivePower.method_1507.exceptionCount",
      start: methodBody.exceptionCountPos,
      end: methodBody.exceptionCountPos + 1,
      data: writeU30(1),
      detail: "add ActivePower.method_1507 exception entry",
    },
    {
      key: "ActivePower.method_1507.exception",
      start: methodBody.exceptionCount === 1 ? methodBody.traitsCountPos - exceptionEntry.length : methodBody.traitsCountPos,
      end: methodBody.traitsCountPos,
      data: exceptionEntry,
      detail: "catch stale caster graphics null references",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched ActivePower.method_1507 null guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
