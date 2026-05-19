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

function resolveDefaultSwf(): string {
  const candidates = [
    path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
    path.resolve(__dirname, "..", "..", "..", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
    path.resolve(process.cwd(), "src", "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

const DEFAULT_SWF = resolveDefaultSwf();

type Operand = [Instruction["operands"][number][0], number];
type InsertedInstruction =
  | { label: string }
  | { opcode: number; operands?: Operand[]; branchTo?: string };

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
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-entity-method900-gfx-guard.ts [--verify] [--swf <path>]",
        "",
        "Patches Entity.method_900 so dead/fading entities with already",
        "cleared gfx DisplayObjects skip position updates instead of",
        "throwing Error #1009.",
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
  if (kind === "s8") {
    return Buffer.from([value & 0xff]);
  }
  if (kind === "s24") {
    return writeS24(value);
  }
  throw new PatchError(`Unsupported operand kind ${kind}`);
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

function getEntityMethod900(swfPath: string) {
  return getEntityMethod(swfPath, "method_900");
}

function getEntityMethod(swfPath: string, methodName: string) {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const classIndex = classIndexByName(abc, "Entity");
  if (classIndex === null) {
    throw new PatchError("Could not find Entity class.");
  }

  const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, methodName);
  if (methodIdx === null) {
    throw new PatchError(`Could not find Entity.${methodName}.`);
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for Entity.${methodName} (${methodIdx}).`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Entity.${methodName}:${methodIdx}`);
  return { ctx, abc, methodBody, code, instructions };
}

function buildGfxGuard(gfxName: number, displayObjectName: number): Buffer {
  return assembleInserted([
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", gfxName]] },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasGfx" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasGfx" },
    { opcode: 0x66, operands: [["u30", displayObjectName]] },
    { opcode: 0x11, branchTo: "ok" },
    { opcode: 0x47 },
    { label: "ok" },
  ]);
}

function buildPreviousUnbalancedGfxGuard(gfxName: number, displayObjectName: number): Buffer {
  return assembleInserted([
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", gfxName]] },
    { opcode: 0x2a },
    { opcode: 0x12, branchTo: "missing" },
    { opcode: 0x66, operands: [["u30", displayObjectName]] },
    { opcode: 0x12, branchTo: "missing" },
    { opcode: 0x10, branchTo: "ok" },
    { label: "missing" },
    { opcode: 0x47 },
    { label: "ok" },
  ]);
}

function hasBalancedGfxGuardAt(
  instructions: Instruction[],
  names: string[],
  insertIndex: number,
): boolean {
  const window = instructions.slice(insertIndex, insertIndex + 9);
  return (
    window[0]?.opcode === 0xd0 &&
    window[1]?.opcode === 0x66 &&
    u30OperandName(window[1], names) === "gfx" &&
    window[2]?.opcode === 0x2a &&
    window[3]?.opcode === 0x11 &&
    window[4]?.opcode === 0x29 &&
    window[5]?.opcode === 0x47 &&
    window[6]?.opcode === 0x66 &&
    u30OperandName(window[6], names) === "m_TheDO" &&
    window[7]?.opcode === 0x11 &&
    window[8]?.opcode === 0x47
  );
}

function findInitInsertIndex(instructions: Instruction[]): number {
  const setLocalIndex = instructions.findIndex((instruction, candidateIndex) =>
    instruction.opcode === 0x63 &&
    instruction.operands[0]?.[1] === 4 &&
    instructions[candidateIndex - 1]?.opcode === 0x24 &&
    instructions[candidateIndex - 1]?.operands[0]?.[1] === 0
  );
  if (setLocalIndex < 0 || !instructions[setLocalIndex + 1]) {
    throw new PatchError("Could not find Entity.method_900 initialization block.");
  }
  return setLocalIndex + 1;
}

function writePatchedMethod(
  swfPath: string,
  methodName: string,
  ctx: ReturnType<typeof parseSwf>,
  methodBody: ReturnType<typeof getEntityMethod>["methodBody"],
  patchedCode: Buffer,
  detail: string,
): void {
  const patches: BytePatch[] = [
    {
      key: `Entity.${methodName}.code`,
      start: methodBody.codeStart,
      end: methodBody.codeStart + methodBody.codeLen,
      data: patchedCode,
      detail,
    },
    {
      key: `Entity.${methodName}.codeLen`,
      start: methodBody.codeLenPos,
      end: methodBody.codeStart,
      data: writeU30(patchedCode.length),
      detail: `update Entity.${methodName} code length`,
    },
  ];

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
}

function patchMethod900(swfPath: string, verify: boolean): boolean {
  const { ctx, abc, methodBody, code, instructions } = getEntityMethod900(swfPath);
  const insertIndex = findInitInsertIndex(instructions);
  const alreadyPatched = hasBalancedGfxGuardAt(instructions, abc.multinameNames, insertIndex);

  if (alreadyPatched) {
    return false;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Entity.method_900 gfx guard is missing.`);
  }

  const guard = buildGfxGuard(
    findRequiredMultiname(abc, "gfx"),
    findRequiredMultiname(abc, "m_TheDO"),
  );
  const previousGuard = buildPreviousUnbalancedGfxGuard(
    findRequiredMultiname(abc, "gfx"),
    findRequiredMultiname(abc, "m_TheDO"),
  );
  const insertOffset = instructions[insertIndex].offset;
  const hasPreviousGuard = code.subarray(insertOffset, insertOffset + previousGuard.length).equals(previousGuard);
  const patchedCode = applyCodeEditsAndAdjustBranches(code, instructions, [
    {
      start: insertOffset,
      end: hasPreviousGuard ? insertOffset + previousGuard.length : insertOffset,
      data: guard,
    },
  ]);

  writePatchedMethod(swfPath, "method_900", ctx, methodBody, patchedCode, "insert dead entity position gfx null guard");
  return true;
}

function buildMethod853GfxGuard(
  gfxName: number,
  displayObjectName: number,
  dataName: number,
  animRootName: number,
): Buffer {
  return assembleInserted([
    { opcode: 0xd0 },
    { opcode: 0x66, operands: [["u30", gfxName]] },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasGfx" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasGfx" },
    { opcode: 0x2a },
    { opcode: 0x66, operands: [["u30", displayObjectName]] },
    { opcode: 0x11, branchTo: "hasDisplayObject" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasDisplayObject" },
    { opcode: 0x2a },
    { opcode: 0x66, operands: [["u30", dataName]] },
    { opcode: 0x2a },
    { opcode: 0x11, branchTo: "hasData" },
    { opcode: 0x29 },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "hasData" },
    { opcode: 0x66, operands: [["u30", animRootName]] },
    { opcode: 0x11, branchTo: "ok" },
    { opcode: 0x29 },
    { opcode: 0x47 },
    { label: "ok" },
    { opcode: 0x29 },
  ]);
}

function countRepeatedSuffix(code: Buffer, endOffset: number, pattern: Buffer): number {
  let count = 0;
  let cursor = endOffset;
  while (cursor >= pattern.length && code.subarray(cursor - pattern.length, cursor).equals(pattern)) {
    count += 1;
    cursor -= pattern.length;
  }
  return count;
}

function findMethod853ScaleBlockIndex(instructions: Instruction[], names: string[]): number {
  const index = instructions.findIndex((instruction, candidateIndex) =>
    instruction.opcode === 0xd0 &&
    instructions[candidateIndex + 1]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 1], names) === "gfx" &&
    instructions[candidateIndex + 2]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 2], names) === "m_TheDO" &&
    instructions[candidateIndex + 3]?.opcode === 0xd0 &&
    instructions[candidateIndex + 4]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 4], names) === "bLeftFacing" &&
    instructions[candidateIndex + 5]?.opcode === 0xd0 &&
    instructions[candidateIndex + 6]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 6], names) === "gfx" &&
    instructions[candidateIndex + 7]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 7], names) === "m_Data" &&
    instructions[candidateIndex + 8]?.opcode === 0x66 &&
    u30OperandName(instructions[candidateIndex + 8], names) === "var_36"
  );
  if (index < 0) {
    throw new PatchError("Could not find Entity.method_853 scaleX gfx block.");
  }
  return index;
}

function patchMethod853(swfPath: string, verify: boolean): boolean {
  const { ctx, abc, methodBody, code, instructions } = getEntityMethod(swfPath, "method_853");
  const scaleBlockIndex = findMethod853ScaleBlockIndex(instructions, abc.multinameNames);
  const guard = buildMethod853GfxGuard(
    findRequiredMultiname(abc, "gfx"),
    findRequiredMultiname(abc, "m_TheDO"),
    findRequiredMultiname(abc, "m_Data"),
    findRequiredMultiname(abc, "var_36"),
  );
  const insertOffset = instructions[scaleBlockIndex].offset;
  const existingGuardCount = countRepeatedSuffix(code, insertOffset, guard);

  if (existingGuardCount === 1) {
    return false;
  }

  if (verify) {
    throw new PatchError(`${swfPath}: verify failed; Entity.method_853 gfx guard is missing or duplicated.`);
  }

  const replaceStart = insertOffset - existingGuardCount * guard.length;
  const patchedCode = applyCodeEditsAndAdjustBranches(code, instructions, [
    { start: replaceStart, end: insertOffset, data: guard },
  ]);

  writePatchedMethod(swfPath, "method_853", ctx, methodBody, patchedCode, "insert dead entity animation gfx null guard");
  return true;
}

function patchSwf(swfPath: string, verify: boolean): void {
  const patched900 = patchMethod900(swfPath, verify);
  const patched853 = patchMethod853(swfPath, verify);

  if (!patched900 && !patched853) {
    console.log(`${swfPath}: already patched (Entity update gfx guards present).`);
    return;
  }

  const patchedMethods = [
    patched900 ? "method_900" : "",
    patched853 ? "method_853" : "",
  ].filter(Boolean).join(", ");
  console.log(`${swfPath}: patched Entity ${patchedMethods} gfx guards.`);
}

const { swfPath, verify } = parseArgs(process.argv);
patchSwf(swfPath, verify);
