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

type Operand = [Instruction["operands"][number][0], number];
type InsertedInstruction =
  | { label: string }
  | { opcode: number; operands?: Operand[]; branchTo?: string };

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-entity-method511-layer-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches Entity.method_511 so spawn/reset display layering skips",
        "stale reference entities instead of crashing getChildIndex().",
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

function isBranchOpcode(opcode: number): boolean {
  return opcode >= 0x0c && opcode <= 0x1a;
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

function assembleInserted(instructions: InsertedInstruction[]): Buffer {
  const labels = new Map<string, number>();
  let offset = 0;

  for (const inst of instructions) {
    if ("label" in inst) {
      labels.set(inst.label, offset);
      continue;
    }
    offset += 1;
    if (inst.branchTo) {
      offset += 3;
    } else {
      for (const [kind, value] of inst.operands ?? []) {
        offset += operandBytes(kind, value).length;
      }
    }
  }

  const chunks: Buffer[] = [];
  const fixups: Array<{ pos: number; target: string }> = [];
  offset = 0;

  for (const inst of instructions) {
    if ("label" in inst) {
      continue;
    }

    const parts: Buffer[] = [Buffer.from([inst.opcode])];
    offset += 1;

    if (inst.branchTo) {
      parts.push(Buffer.alloc(3));
      fixups.push({ pos: offset, target: inst.branchTo });
      offset += 3;
    } else {
      for (const [kind, value] of inst.operands ?? []) {
        const bytes = operandBytes(kind, value);
        parts.push(bytes);
        offset += bytes.length;
      }
    }

    chunks.push(Buffer.concat(parts));
  }

  const assembled = Buffer.concat(chunks);
  for (const fixup of fixups) {
    const target = labels.get(fixup.target);
    if (target === undefined) {
      throw new PatchError(`Unknown branch label ${fixup.target}`);
    }
    writeS24(target - (fixup.pos + 3)).copy(assembled, fixup.pos);
  }

  return assembled;
}

function applyCodeEditsAndAdjustBranches(
  originalCode: Buffer,
  instructions: Instruction[],
  edits: Array<{ start: number; end: number; data: Buffer }>,
): Buffer {
  const ordered = [...edits].sort((left, right) => left.start - right.start);
  const chunks: Buffer[] = [];
  let cursor = 0;
  for (const edit of ordered) {
    chunks.push(originalCode.subarray(cursor, edit.start));
    chunks.push(edit.data);
    cursor = edit.end;
  }
  chunks.push(originalCode.subarray(cursor));

  const patched = Buffer.concat(chunks);

  function deltaFor(edit: { start: number; end: number; data: Buffer }): number {
    return edit.data.length - (edit.end - edit.start);
  }

  function isInsideEdit(offset: number): boolean {
    return ordered.some((edit) => offset >= edit.start && offset < edit.end);
  }

  function mapInstructionOffset(offset: number): number {
    let mapped = offset;
    for (const edit of ordered) {
      if (edit.end <= offset || (edit.start === edit.end && edit.start <= offset)) {
        mapped += deltaFor(edit);
      }
    }
    return mapped;
  }

  function mapTargetOffset(offset: number): number {
    let mapped = offset;
    for (const edit of ordered) {
      if (offset < edit.start) {
        continue;
      }
      if (edit.start === edit.end && offset === edit.start) {
        return edit.start + (mapped - offset);
      }
      if (offset >= edit.start && offset < edit.end) {
        return edit.start + (mapped - offset);
      }
      if (offset === edit.end) {
        return edit.start + edit.data.length + (mapped - offset);
      }
      mapped += deltaFor(edit);
    }
    return mapped;
  }

  for (const inst of instructions) {
    if (!isBranchOpcode(inst.opcode) || isInsideEdit(inst.offset)) {
      continue;
    }
    const branch = inst.operands[0];
    if (branch?.[0] !== "s24") {
      throw new PatchError(`Unexpected branch operand at original offset ${inst.offset}`);
    }

    const oldEnd = inst.offset + inst.size;
    const oldTarget = oldEnd + branch[1];
    const newInstOffset = mapInstructionOffset(inst.offset);
    const newEnd = newInstOffset + inst.size;
    const newTarget = mapTargetOffset(oldTarget);
    writeS24(newTarget - newEnd).copy(patched, newInstOffset + 1);
  }

  return patched;
}

function findRequiredMultiname(abc: ReturnType<typeof parseAbc>, name: string): number {
  const index = abc.multinameNames.findIndex((candidate) => candidate === name);
  if (index < 0) {
    throw new PatchError(`Multiname ${name} not found`);
  }
  return index;
}

function getEntityMethod511(swfPath: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Entity");
  if (classIndex === null) {
    throw new PatchError("Could not find Entity class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, "method_511");
  if (methodIdx === null) {
    throw new PatchError("Could not find Entity.method_511.");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for Entity.method_511 (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Entity.method_511:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function buildLayerReferenceGuard(
  gfxName: number,
  displayObjectName: number,
  parentName: number,
  var1Name: number,
  playerEntLayerName: number,
): Buffer {
  return assembleInserted([
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", gfxName]] },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasSelfGfx" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasSelfGfx" },
    { opcode: 0x66, operands: [["u30", displayObjectName]] },
    { opcode: 0x11, branchTo: "hasSelfDisplayObject" },
    { opcode: 0x47 },
    { label: "hasSelfDisplayObject" },
    { opcode: 0xd2 },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasReferenceEntity" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasReferenceEntity" },
    { opcode: 0x66, operands: [["u30", gfxName]] },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasReferenceGfx" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasReferenceGfx" },
    { opcode: 0x66, operands: [["u30", displayObjectName]] },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasReferenceDisplayObject" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasReferenceDisplayObject" },
    { opcode: 0x66, operands: [["u30", parentName]] },
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", var1Name]] },
    { opcode: 0x66, operands: [["u30", playerEntLayerName]] },
    { opcode: 0xab },
    { opcode: 0x11, branchTo: "ok" },
    { opcode: 0x47 },
    { label: "ok" },
  ]);
}

function findLayerReferenceExpressionStartIndex(instructions: Instruction[], names: string[]): number {
  const index = instructions.findIndex((instruction, candidateIndex) =>
    instruction.opcode === 0xd0 &&
    instructions[candidateIndex + 1]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 1], names) === "var_1" &&
    instructions[candidateIndex + 2]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 2], names) === "playerEntLayer" &&
    instructions[candidateIndex + 3]?.opcode === 0xd0 &&
    instructions[candidateIndex + 4]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 4], names) === "gfx" &&
    instructions[candidateIndex + 5]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 5], names) === "m_TheDO" &&
    instructions.slice(candidateIndex + 6, candidateIndex + 90).some((nested, nestedOffset, nestedWindow) =>
      nested.opcode === 0xd0 &&
      nestedWindow[nestedOffset + 1]?.opcode === 0x66 &&
      u30OperandName(nestedWindow[nestedOffset + 1], names) === "var_1" &&
      nestedWindow[nestedOffset + 2]?.opcode === 0x66 &&
      u30OperandName(nestedWindow[nestedOffset + 2], names) === "playerEntLayer" &&
      nestedWindow[nestedOffset + 3]?.opcode === 0xd2 &&
      nestedWindow[nestedOffset + 4]?.opcode === 0x66 &&
      u30OperandName(nestedWindow[nestedOffset + 4], names) === "gfx" &&
      nestedWindow[nestedOffset + 5]?.opcode === 0x66 &&
      u30OperandName(nestedWindow[nestedOffset + 5], names) === "m_TheDO" &&
      nestedWindow[nestedOffset + 6]?.opcode === 0x46 &&
      u30OperandName(nestedWindow[nestedOffset + 6], names) === "getChildIndex"
    )
  );

  if (index < 0) {
    throw new PatchError("Could not find Entity.method_511 getChildIndex reference layering block.");
  }

  return index;
}

function findLayerReferenceGuardIndex(instructions: Instruction[], names: string[]): number {
  return instructions.findIndex((instruction, index) =>
    instruction.opcode === 0xd0 &&
    instructions[index + 1]?.opcode === 0x66 &&
    u30OperandName(instructions[index + 1], names) === "gfx" &&
    instructions[index + 2]?.opcode === 0x2a &&
    instructions[index + 3]?.opcode === 0x11 &&
    instructions[index + 4]?.opcode === 0x29 &&
    instructions[index + 5]?.opcode === 0x47 &&
    instructions[index + 6]?.opcode === 0x66 &&
    u30OperandName(instructions[index + 6], names) === "m_TheDO" &&
    instructions[index + 7]?.opcode === 0x11 &&
    instructions[index + 8]?.opcode === 0x47 &&
    instructions[index + 9]?.opcode === 0xd2 &&
    instructions[index + 10]?.opcode === 0x2a &&
    instructions[index + 11]?.opcode === 0x11 &&
    instructions[index + 12]?.opcode === 0x29 &&
    instructions[index + 13]?.opcode === 0x47 &&
    instructions[index + 14]?.opcode === 0x66 &&
    u30OperandName(instructions[index + 14], names) === "gfx" &&
    instructions[index + 15]?.opcode === 0x2a &&
    instructions[index + 16]?.opcode === 0x11 &&
    instructions[index + 17]?.opcode === 0x29 &&
    instructions[index + 18]?.opcode === 0x47 &&
    instructions[index + 19]?.opcode === 0x66 &&
    u30OperandName(instructions[index + 19], names) === "m_TheDO" &&
    instructions[index + 20]?.opcode === 0x2a &&
    instructions[index + 21]?.opcode === 0x11 &&
    instructions[index + 22]?.opcode === 0x29 &&
    instructions[index + 23]?.opcode === 0x47 &&
    instructions[index + 24]?.opcode === 0x66 &&
    u30OperandName(instructions[index + 24], names) === "parent" &&
    instructions[index + 25]?.opcode === 0xd0 &&
    instructions[index + 26]?.opcode === 0x66 &&
    u30OperandName(instructions[index + 26], names) === "var_1" &&
    instructions[index + 27]?.opcode === 0x66 &&
    u30OperandName(instructions[index + 27], names) === "playerEntLayer" &&
    instructions[index + 28]?.opcode === 0xab &&
    instructions[index + 29]?.opcode === 0x11 &&
    instructions[index + 30]?.opcode === 0x47
  );
}

function findStaleBranchTargets(instructions: Instruction[], targetOffset: number, guardOffset: number): Instruction[] {
  return instructions.filter((instruction) => {
    if (!isBranchOpcode(instruction.opcode) || instruction.offset >= guardOffset) {
      return false;
    }
    const branch = instruction.operands[0];
    if (branch?.[0] !== "s24") {
      return false;
    }
    return instruction.offset + instruction.size + branch[1] === targetOffset;
  });
}

function writePatchedMethod(
  swfPath: string,
  ctx: ReturnType<typeof parseSwf>,
  methodBody: ReturnType<typeof getEntityMethod511>["methodBody"],
  patchedCode: Buffer,
  detail: string,
): void {
  const patches: BytePatch[] = [
    {
      key: "Entity.method_511.code",
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail,
    },
    {
      key: "Entity.method_511.codeLen",
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: "update Entity.method_511 code length",
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
}

function patchSwf(swfPath: string, verify: boolean): void {
  const { ctx, abc, methodBody, code, instructions } = getEntityMethod511(swfPath);
  const guard = buildLayerReferenceGuard(
    findRequiredMultiname(abc, "gfx"),
    findRequiredMultiname(abc, "m_TheDO"),
    findRequiredMultiname(abc, "parent"),
    findRequiredMultiname(abc, "var_1"),
    findRequiredMultiname(abc, "playerEntLayer"),
  );
  const expressionStartIndex = findLayerReferenceExpressionStartIndex(instructions, abc.multinameNames);
  const expressionStartOffset = instructions[expressionStartIndex].offset;
  const hasCorrectGuard =
    expressionStartOffset >= guard.length &&
    code.subarray(expressionStartOffset - guard.length, expressionStartOffset).equals(guard);
  const guardStartOffset = expressionStartOffset - guard.length;
  const staleBranches = hasCorrectGuard
    ? findStaleBranchTargets(instructions, expressionStartOffset, guardStartOffset)
    : [];

  if (hasCorrectGuard && staleBranches.length === 0) {
    console.log(`${swfPath}: already patched (Entity.method_511 layer reference guard present).`);
    return;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Entity.method_511 layer reference guard is missing.`);
  }

  if (hasCorrectGuard && staleBranches.length > 0) {
    const patchedCode = Buffer.from(code);
    for (const branch of staleBranches) {
      writeS24(guardStartOffset - (branch.offset + branch.size)).copy(patchedCode, branch.offset + 1);
    }
    writePatchedMethod(swfPath, ctx, methodBody, patchedCode, "retarget Entity.method_511 branches through layer guard");
    console.log(`${swfPath}: patched Entity.method_511 layer guard branch targets.`);
    return;
  }

  const existingGuardIndex = findLayerReferenceGuardIndex(instructions, abc.multinameNames);
  const existingGuardOffset = existingGuardIndex >= 0 ? instructions[existingGuardIndex].offset : -1;
  const edits = [
    { start: expressionStartOffset, end: expressionStartOffset, data: guard },
    ...(existingGuardOffset >= 0
      ? [{ start: existingGuardOffset, end: existingGuardOffset + guard.length, data: Buffer.alloc(0) }]
      : []),
  ];
  const patchedCode = applyCodeEditsAndAdjustBranches(code, instructions, edits);

  writePatchedMethod(swfPath, ctx, methodBody, patchedCode, "insert spawn/reset display layer reference guard");
  console.log(`${swfPath}: patched Entity.method_511 layer reference guard.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
