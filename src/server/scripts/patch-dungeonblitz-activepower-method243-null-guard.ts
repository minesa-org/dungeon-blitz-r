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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-activepower-method243-null-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches ActivePower.method_243 so stale/null active power references return",
        "false instead of crashing the Flash client during high-damage ticks.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function getActivePowerMethod243(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "ActivePower");
  if (classIndex === null) {
    throw new PatchError("Could not find ActivePower class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_243");
  if (methodIdx === null) {
    throw new PatchError("Could not find ActivePower.method_243.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for ActivePower.method_243 (${methodIdx}).`);
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

function method243AlreadyPatched(
  methodBody: ReturnType<typeof getActivePowerMethod243>["methodBody"],
  code: Buffer,
): boolean {
  return methodBody.exceptions.some((exception) => {
    if (exception.from !== 0) {
      return false;
    }
    const handler = code.subarray(exception.target);
    return (
      handler[0] === 0x29 &&
      handler[1] === 0xd0 &&
      handler.includes(0x4f) &&
      handler[handler.length - 2] === 0x27 &&
      handler[handler.length - 1] === 0x48
    );
  });
}

function buildCatchHandler(abc: ReturnType<typeof parseAbc>): Buffer {
  const method129Name = getRequiredMultiname(abc, "method_129");
  return Buffer.concat([
    Buffer.from([0x29, 0xd0, 0x4f]),
    writeU30(method129Name),
    writeU30(0),
    Buffer.from([0x27, 0x48]),
  ]);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, methodBody, code } = getActivePowerMethod243(swfPath);
  const abc = parseAbc(ctx);
  if (method243AlreadyPatched(methodBody, code)) {
    console.log(`${swfPath}: already patched (ActivePower.method_243 null guard present).`);
    return;
  }

  if (methodBody.exceptionCount > 1) {
    throw new PatchError(`${swfPath}: ActivePower.method_243 has an unexpected exception table.`);
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; ActivePower.method_243 null guard is missing.`);
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
      key: "ActivePower.method_243.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail: "append null-reference catch handler returning false",
    },
    {
      key: "ActivePower.method_243.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update ActivePower.method_243 code length",
    },
    {
      key: "ActivePower.method_243.exceptionCount",
      start: methodBody.exceptionCountPos,
      end: methodBody.exceptionCountPos + 1,
      data: writeU30(1),
      detail: "add ActivePower.method_243 exception entry",
    },
    {
      key: "ActivePower.method_243.exception",
      start: methodBody.exceptionCount === 1 ? methodBody.traitsCountPos - exceptionEntry.length : methodBody.traitsCountPos,
      end: methodBody.traitsCountPos,
      data: exceptionEntry,
      detail: "catch stale active power null references",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`${swfPath}: patched ActivePower.method_243 null guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
