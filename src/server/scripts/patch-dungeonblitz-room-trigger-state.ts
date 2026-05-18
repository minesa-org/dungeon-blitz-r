import * as path from "path";
import {
  applyPatchesToBody,
  BytePatch,
  classIndexByName,
  disassemble,
  ensureBackup,
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

type Args = {
  swfPath: string;
  outputPath: string;
  verify: boolean;
};

function parseArgs(argv: string[]): Args {
  let swfPath = DEFAULT_SWF;
  let outputPath = "";
  let verify = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--swf" || arg === "-s") {
      swfPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      outputPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--verify" || arg === "--dry-run") {
      verify = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  ts-node src/server/scripts/patch-dungeonblitz-room-trigger-state.ts [--verify] [--swf <path>] [--output <path>]",
        "",
        "Allows Room.method_1147 to consume remote room state commands of the form roomId^Trigger^triggerName.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, outputPath: outputPath || swfPath, verify };
}

function s24(value: number): Buffer {
  if (value < -0x800000 || value > 0x7fffff) {
    throw new PatchError(`s24 branch offset out of range: ${value}`);
  }
  const encoded = value < 0 ? value + 0x1000000 : value;
  return Buffer.from([encoded & 0xff, (encoded >> 8) & 0xff, (encoded >> 16) & 0xff]);
}

function ins(opcode: number, ...operands: number[]): Buffer {
  const chunks: Buffer[] = [Buffer.from([opcode])];
  for (const operand of operands) {
    chunks.push(writeU30(operand));
  }
  return Buffer.concat(chunks);
}

function getRequiredString(abc: ReturnType<typeof parseAbc>, value: string): number {
  const index = abc.stringValues.findIndex((entry) => entry === value);
  if (index <= 0) {
    throw new PatchError(`Missing string constant: ${JSON.stringify(value)}`);
  }
  return index;
}

function getRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((value) => value === name);
  if (index <= 0) {
    throw new PatchError(`Missing multiname: ${name}`);
  }
  return index;
}

function buildTriggerStatePrefix(abc: ReturnType<typeof parseAbc>): Buffer {
  const triggerString = getRequiredString(abc, "Trigger");
  const method79 = getRequiredMultiname(abc, "method_79");
  const triggerBody = Buffer.concat([
    Buffer.from([0xd0]), // getlocal0
    Buffer.from([0xd2]), // getlocal2: trigger name
    ins(0x4f, method79, 1), // callpropvoid method_79, 1
    Buffer.from([0x47]), // returnvoid
  ]);

  return Buffer.concat([
    Buffer.from([0xd1]), // getlocal1: command name
    ins(0x2c, triggerString), // pushstring "Trigger"
    Buffer.concat([Buffer.from([0x14]), s24(triggerBody.length)]), // ifne original method body
    triggerBody,
  ]);
}

function analyzePatch(swfPath: string): { ctx: ReturnType<typeof parseSwf>; patches: BytePatch[] } {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Room");
  if (classIndex === null) {
    throw new PatchError("Room class not found");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_1147");
  if (methodIdx === null) {
    throw new PatchError("Room.method_1147 not found");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError("Room.method_1147 body not found");
  }
  if (methodBody.exceptionCount !== 0) {
    throw new PatchError("Room.method_1147 has exception ranges; refusing to insert without exception remapping");
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instrs = disassemble(code, "Room.method_1147");
  if (
    instrs[0]?.opcode === 0xd1 &&
    instrs[1]?.opcode === 0x2c &&
    u30OperandName(instrs[1], abc.stringValues) === "Trigger" &&
    instrs.some((inst) => inst.opcode === 0x4f && u30OperandName(inst, abc.multinameNames) === "method_79")
  ) {
    return { ctx, patches: [] };
  }

  const prefix = buildTriggerStatePrefix(abc);
  const newCode = Buffer.concat([prefix, code]);
  const oldCodeLenBytes = writeU30(methodBody.codeLen);
  const newCodeLenBytes = writeU30(newCode.length);
  if (oldCodeLenBytes.length !== newCodeLenBytes.length) {
    throw new PatchError(
      `Unsupported Room.method_1147 code_length varint width change: ${oldCodeLenBytes.length} -> ${newCodeLenBytes.length}`,
    );
  }

  return {
    ctx,
    patches: [
      {
        key: "room-method-1147-trigger-state-code-length",
        start: methodBody.codeLenPos,
        end: methodBody.codeLenPos + oldCodeLenBytes.length,
        data: newCodeLenBytes,
        detail: `Room.method_1147 code_length ${methodBody.codeLen} -> ${newCode.length}`,
      },
      {
        key: "room-method-1147-trigger-state-code",
        start: methodBody.codeStart,
        end: methodBody.codeStart + methodBody.codeLen,
        data: newCode,
        detail: 'Allow remote room state command "Trigger" to call Room.method_79(triggerName)',
      },
    ],
  };
}

function main(): number {
  const args = parseArgs(process.argv);
  const { ctx, patches } = analyzePatch(args.swfPath);
  console.log(`SWF: ${args.swfPath}`);

  if (patches.length === 0) {
    console.log("No changes needed.");
    return 0;
  }

  for (const patch of patches) {
    console.log(`Patch: ${patch.detail}`);
  }
  if (args.verify) {
    return 0;
  }

  if (path.resolve(args.outputPath) === path.resolve(args.swfPath)) {
    ensureBackup(args.swfPath);
  }
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  ctx.path = args.outputPath;
  writeSwf(ctx, body, delta);
  console.log(`Patched SWF written to ${args.outputPath}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
