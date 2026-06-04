import {
  applyPatchesToBody,
  classIndexByName,
  disassemble,
  ensureBackup,
  methodIdxForTrait,
  parseAbc,
  parseSwf,
  u30OperandName,
  writeSwf,
  writeU30,
  type AbcParseResult,
  type Instruction,
  type MethodBodyInfo,
} from "./swfPatchUtils";

const DEFAULT_SWF = "src/client/content/localhost/p/cbp/DungeonBlitz.swf";
const CLASS_NAME = "class_129";
const METHOD_NAME = "method_1376";

type Args = {
  swf: string;
  verify: boolean;
};

type Operands = {
  var528: number;
  refresh: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    swf: DEFAULT_SWF,
    verify: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--swf" || arg === "-s") {
      args.swf = argv[++index] ?? "";
      continue;
    }
    if (arg === "--verify") {
      args.verify = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  npx tsx src/server/scripts/patch-dungeonblitz-spellbook-discipline-tabs.ts [--verify] [--swf <path>]",
        "",
        "Patches the spellbook tab click handler so the player can switch to",
        "any discipline tab.",
      ].join("\n"));
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!args.swf) {
    throw new Error("Missing SWF path.");
  }
  return args;
}

function requireClassMethod(abc: AbcParseResult): { methodIdx: number; body: MethodBodyInfo; code: Buffer } {
  const classIndex = classIndexByName(abc, CLASS_NAME);
  if (classIndex === null) {
    throw new Error(`Could not find ${CLASS_NAME}`);
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, METHOD_NAME);
  if (methodIdx === null) {
    throw new Error(`Could not find ${CLASS_NAME}.${METHOD_NAME}`);
  }

  const body = abc.methodBodies.get(methodIdx);
  if (!body) {
    throw new Error(`Could not find method body for ${CLASS_NAME}.${METHOD_NAME}`);
  }

  if (body.exceptionCount !== 0) {
    throw new Error(`${CLASS_NAME}.${METHOD_NAME} has exceptions; refusing to replace its body.`);
  }

  return { methodIdx, body, code: Buffer.alloc(0) };
}

function namedOperand(inst: Instruction, abc: AbcParseResult): string | null {
  return u30OperandName(inst, abc.multinameNames);
}

function operandByName(instructions: Instruction[], abc: AbcParseResult, name: string, opcode?: number): number {
  for (const inst of instructions) {
    if (opcode !== undefined && inst.opcode !== opcode) {
      continue;
    }
    if (namedOperand(inst, abc) === name && inst.operands[0]?.[0] === "u30") {
      return inst.operands[0][1];
    }
  }
  throw new Error(`Could not find operand ${name}${opcode === undefined ? "" : ` for opcode 0x${opcode.toString(16)}`}`);
}

function collectOperands(abc: AbcParseResult, tabInstructions: Instruction[]): Operands {
  const refresh = operandByName(tabInstructions, abc, "Refresh", 0x5d);
  const var528 = operandByName(tabInstructions, abc, "var_528", 0x68);

  return {
    var528,
    refresh,
  };
}

function buildTabCode(operands: Operands): Buffer {
  const bytes: number[] = [];

  const emit = (...values: number[]) => {
    bytes.push(...values);
  };
  const emitU30 = (value: number) => {
    emit(...writeU30(value));
  };

  emit(0xd0); // getlocal0
  emit(0x30); // pushscope
  emit(0xd0); // getlocal0
  emit(0xd2); // getlocal2
  emit(0x68); // initproperty var_528
  emitU30(operands.var528);
  emit(0x5d); // findpropstrict Refresh
  emitU30(operands.refresh);
  emit(0x4f); // callpropvoid Refresh, 0
  emitU30(operands.refresh);
  emitU30(0);
  emit(0x47); // returnvoid

  return Buffer.from(bytes);
}

function isPatched(instructions: Instruction[], abc: AbcParseResult): boolean {
  const names = new Set(
    instructions
      .map((inst) => namedOperand(inst, abc))
      .filter((name): name is string => Boolean(name)),
  );
  return names.has("var_528") && names.has("Refresh") && !names.has("mMasterClass") && !names.has("className");
}

function main(): void {
  const args = parseArgs(process.argv);
  const ctx = parseSwf(args.swf);
  const abc = parseAbc(ctx);
  const { methodIdx, body } = requireClassMethod(abc);
  const code = ctx.body.subarray(body.codeStart, body.codeStart + body.codeLen);
  const instructions = disassemble(code, `${CLASS_NAME}.${METHOD_NAME}:${methodIdx}`);

  if (isPatched(instructions, abc)) {
    console.log(`${args.swf}: already patched (${CLASS_NAME}.${METHOD_NAME} all discipline tabs).`);
    return;
  }

  if (args.verify) {
    throw new Error(`${args.swf}: missing ${CLASS_NAME}.${METHOD_NAME} all-discipline tab patch.`);
  }

  const operands = collectOperands(abc, instructions);
  const patchedCode = buildTabCode(operands);
  const codeLen = writeU30(patchedCode.length);
  const { body: patchedBody, delta } = applyPatchesToBody(ctx.body, [
    {
      key: `${CLASS_NAME}.${METHOD_NAME}.code`,
      start: body.codeStart,
      end: body.codeStart + body.codeLen,
      data: patchedCode,
      detail: `Replace ${CLASS_NAME}.${METHOD_NAME} with all-discipline tab handler`,
    },
    {
      key: `${CLASS_NAME}.${METHOD_NAME}.codeLen`,
      start: body.codeLenPos,
      end: body.codeStart,
      data: codeLen,
      detail: `Update ${CLASS_NAME}.${METHOD_NAME} code length`,
    },
  ]);

  ensureBackup(args.swf);
  writeSwf(ctx, patchedBody, delta);

  const verifyCtx = parseSwf(args.swf);
  const verifyAbc = parseAbc(verifyCtx);
  const { methodIdx: verifyMethodIdx, body: verifyBody } = requireClassMethod(verifyAbc);
  const verifyCode = verifyCtx.body.subarray(verifyBody.codeStart, verifyBody.codeStart + verifyBody.codeLen);
  const verifyInstructions = disassemble(verifyCode, `${CLASS_NAME}.${METHOD_NAME}:${verifyMethodIdx}`);
  if (!isPatched(verifyInstructions, verifyAbc)) {
    throw new Error(`${args.swf}: patch did not verify after write.`);
  }

  console.log(`${args.swf}: patched ${CLASS_NAME}.${METHOD_NAME} all discipline tabs.`);
}

main();
