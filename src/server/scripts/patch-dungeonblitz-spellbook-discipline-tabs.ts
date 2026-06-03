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
  var1: number;
  clientEnt: number;
  entType: number;
  className: number;
  masterClass: number;
  var672: number;
  var528: number;
  refresh: number;
  toLowerCase: number;
  indexLookup: number;
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
        "Patches the spellbook tab click handler so the player can only switch to",
        "their base class tab or current discipline tab.",
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

function findMethodInstructions(abc: AbcParseResult, className: string, methodName: string, swfBody: Buffer): Instruction[] {
  const classIndex = classIndexByName(abc, className);
  if (classIndex === null) {
    throw new Error(`Could not find ${className}`);
  }
  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, methodName);
  if (methodIdx === null) {
    throw new Error(`Could not find ${className}.${methodName}`);
  }
  const body = abc.methodBodies.get(methodIdx);
  if (!body) {
    throw new Error(`Could not find method body for ${className}.${methodName}`);
  }
  const code = swfBody.subarray(body.codeStart, body.codeStart + body.codeLen);
  return disassemble(code, `${className}.${methodName}`);
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

function findFirstOperandByName(abc: AbcParseResult, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index <= 0) {
    throw new Error(`Could not find multiname ${name}`);
  }
  return index;
}

function collectOperands(abc: AbcParseResult, swfBody: Buffer, tabInstructions: Instruction[]): Operands {
  const refresh = operandByName(tabInstructions, abc, "Refresh", 0x5d);
  const var528 = operandByName(tabInstructions, abc, "var_528", 0x68);
  const method1485 = findMethodInstructions(abc, CLASS_NAME, "method_1485", swfBody);
  const onRefresh = findMethodInstructions(abc, CLASS_NAME, "OnRefreshScreen", swfBody);

  const var1 = operandByName(method1485, abc, "var_1", 0x60);
  const clientEnt = operandByName(method1485, abc, "clientEnt", 0x66);
  const var672Index = method1485.findIndex((inst) => inst.opcode === 0x66 && namedOperand(inst, abc) === "var_672");
  if (var672Index === -1) {
    throw new Error("Could not find var_672 access in class_129.method_1485");
  }

  const var672 = method1485[var672Index].operands[0][1];
  let indexLookup = 0;
  for (let index = var672Index + 1; index < method1485.length; index += 1) {
    const inst = method1485[index];
    if (inst.opcode !== 0x66 || inst.operands[0]?.[0] !== "u30") {
      continue;
    }
    const operandName = namedOperand(inst, abc);
    if (operandName === "var_528") {
      continue;
    }
    indexLookup = inst.operands[0][1];
    break;
  }
  if (!indexLookup) {
    throw new Error("Could not find vector index lookup after var_672 access.");
  }

  let className = 0;
  let toLowerCase = 0;
  let masterClass = 0;
  for (let index = 0; index < onRefresh.length - 4; index += 1) {
    const first = onRefresh[index];
    const second = onRefresh[index + 1];
    const third = onRefresh[index + 2];
    const fourth = onRefresh[index + 3];
    if (
      first.opcode === 0x66 &&
      namedOperand(first, abc) === "className" &&
      second.opcode === 0x46 &&
      namedOperand(second, abc) === "toLowerCase" &&
      third.opcode >= 0xd0 &&
      third.opcode <= 0xd7 &&
      fourth.opcode === 0x66 &&
      namedOperand(fourth, abc) === "mMasterClass"
    ) {
      className = first.operands[0][1];
      toLowerCase = second.operands[0][1];
      masterClass = fourth.operands[0][1];
      break;
    }
  }

  if (!className || !toLowerCase || !masterClass) {
    throw new Error("Could not find className.toLowerCase() / mMasterClass operands.");
  }

  return {
    var1,
    clientEnt,
    entType: findFirstOperandByName(abc, "entType"),
    className,
    masterClass,
    var672,
    var528,
    refresh,
    toLowerCase,
    indexLookup,
  };
}

function writeS24(buffer: Buffer, pos: number, value: number): void {
  if (value < -0x800000 || value > 0x7fffff) {
    throw new Error(`s24 branch offset out of range: ${value}`);
  }
  const encoded = value < 0 ? value + 0x1000000 : value;
  buffer[pos] = encoded & 0xff;
  buffer[pos + 1] = (encoded >> 8) & 0xff;
  buffer[pos + 2] = (encoded >> 16) & 0xff;
}

function buildTabGateCode(operands: Operands): Buffer {
  const bytes: number[] = [];
  const labels = new Map<string, number>();
  const branches: Array<{ operandPos: number; label: string }> = [];

  const emit = (...values: number[]) => {
    bytes.push(...values);
  };
  const emitU30 = (value: number) => {
    emit(...writeU30(value));
  };
  const mark = (label: string) => {
    labels.set(label, bytes.length);
  };
  const branch = (opcode: number, label: string) => {
    emit(opcode);
    branches.push({ operandPos: bytes.length, label });
    emit(0, 0, 0);
  };
  const getproperty = (operand: number) => {
    emit(0x66);
    emitU30(operand);
  };

  emit(0xd0); // getlocal0
  emit(0x30); // pushscope
  emit(0x60); // getlex var_1
  emitU30(operands.var1);
  getproperty(operands.clientEnt);
  emit(0xd7); // setlocal3
  emit(0xd3); // getlocal3
  branch(0x11, "hasEntity"); // iftrue
  emit(0x47); // returnvoid

  mark("hasEntity");
  emit(0xd3); // getlocal3
  getproperty(operands.entType);
  branch(0x11, "hasEntType");
  emit(0x47); // returnvoid

  mark("hasEntType");
  emit(0xd0); // getlocal0
  getproperty(operands.var672);
  emit(0xd2); // getlocal2
  getproperty(operands.indexLookup);
  emit(0x85); // coerce_s
  emit(0x63); // setlocal 4
  emitU30(4);
  emit(0x62); // getlocal 4
  emitU30(4);
  branch(0x11, "hasCategory");
  emit(0x47); // returnvoid

  mark("hasCategory");
  emit(0x62); // getlocal 4
  emitU30(4);
  emit(0xd3); // getlocal3
  getproperty(operands.entType);
  getproperty(operands.className);
  emit(0xab); // equals
  branch(0x11, "allowed");

  emit(0x62); // getlocal 4
  emitU30(4);
  emit(0x46); // callproperty toLowerCase, 0
  emitU30(operands.toLowerCase);
  emitU30(0);
  emit(0xd3); // getlocal3
  getproperty(operands.masterClass);
  emit(0xab); // equals
  branch(0x11, "allowed");
  emit(0x47); // returnvoid

  mark("allowed");
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

  const out = Buffer.from(bytes);
  for (const pending of branches) {
    const labelOffset = labels.get(pending.label);
    if (labelOffset === undefined) {
      throw new Error(`Missing branch label ${pending.label}`);
    }
    writeS24(out, pending.operandPos, labelOffset - (pending.operandPos + 3));
  }

  return out;
}

function isPatched(instructions: Instruction[], abc: AbcParseResult): boolean {
  const names = new Set(
    instructions
      .map((inst) => namedOperand(inst, abc))
      .filter((name): name is string => Boolean(name)),
  );
  return ["var_672", "entType", "className", "mMasterClass", "var_528", "Refresh"].every((name) => names.has(name));
}

function main(): void {
  const args = parseArgs(process.argv);
  const ctx = parseSwf(args.swf);
  const abc = parseAbc(ctx);
  const { methodIdx, body } = requireClassMethod(abc);
  const code = ctx.body.subarray(body.codeStart, body.codeStart + body.codeLen);
  const instructions = disassemble(code, `${CLASS_NAME}.${METHOD_NAME}:${methodIdx}`);

  if (isPatched(instructions, abc)) {
    console.log(`${args.swf}: already patched (${CLASS_NAME}.${METHOD_NAME} discipline tabs).`);
    return;
  }

  if (args.verify) {
    throw new Error(`${args.swf}: missing ${CLASS_NAME}.${METHOD_NAME} discipline tab gate.`);
  }

  const operands = collectOperands(abc, ctx.body, instructions);
  const patchedCode = buildTabGateCode(operands);
  const codeLen = writeU30(patchedCode.length);
  const { body: patchedBody, delta } = applyPatchesToBody(ctx.body, [
    {
      key: `${CLASS_NAME}.${METHOD_NAME}.code`,
      start: body.codeStart,
      end: body.codeStart + body.codeLen,
      data: patchedCode,
      detail: `Replace ${CLASS_NAME}.${METHOD_NAME} with discipline tab gate`,
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

  console.log(`${args.swf}: patched ${CLASS_NAME}.${METHOD_NAME} discipline tabs.`);
}

main();
