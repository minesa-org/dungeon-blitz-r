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
  writeSwf,
  writeU30,
} from "./swfPatchUtils";

const DEFAULT_SWF_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "client",
  "content",
  "localhost",
  "p",
  "cbp",
  "DungeonBlitz.swf"
);

interface ParsedArgs {
  swfPath: string;
  verify: boolean;
}

interface DoorLabelRefs {
  dedicatedLabelIndex: number;
  fallbackRefOffset: number;
  fallbackRefSize: number;
  alreadyPatched: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  let swfPath = DEFAULT_SWF_PATH;
  let verify = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--verify") {
      verify = true;
      continue;
    }
    if (arg === "--swf" || arg === "-s") {
      swfPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  npm exec tsx src/server/scripts/patch-dungeon-door-label.ts [--verify] [--swf <path>]",
        "",
        'Patches DungeonBlitz.swf so zone transition badges say "Travel to" instead of "Dungeon".',
      ].join("\n"));
      process.exit(0);
    }
    if (!arg.startsWith("-") && swfPath === DEFAULT_SWF_PATH) {
      swfPath = path.resolve(arg);
      continue;
    }
    throw new PatchError(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

function findDoorLabelRefs(swfPath: string): DoorLabelRefs {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const entityClassIndex = classIndexByName(abc, "Entity");
  if (entityClassIndex === null) {
    throw new PatchError("Could not find Entity class in DungeonBlitz.swf");
  }

  const methodIdx = methodIdxForTrait(abc.instances[entityClassIndex].traits, abc, "method_579");
  if (methodIdx === null) {
    throw new PatchError("Could not find Entity.method_579 in DungeonBlitz.swf");
  }

  const methodBody = abc.methodBodies.get(methodIdx);
  if (!methodBody) {
    throw new PatchError(`Could not find method body for Entity.method_579 (${methodIdx})`);
  }

  const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
  const instructions = disassemble(code, `Entity.method_579:${methodIdx}`);
  const labelRefs = instructions
    .filter((instruction) => {
      if (instruction.opcode !== 0x2c || instruction.operands[0]?.[0] !== "u30") {
        return false;
      }
      const value = abc.stringValues[instruction.operands[0][1]];
      return value === "Dungeon" || value === "Travel to";
    })
    .map((instruction) => ({
      instruction,
      stringIndex: instruction.operands[0][1],
      value: abc.stringValues[instruction.operands[0][1]],
    }));

  if (labelRefs.length !== 2) {
    throw new PatchError(`Expected two Entity.method_579 door label string refs, found ${labelRefs.length}`);
  }

  const [primaryRef, fallbackRef] = labelRefs;
  const alreadyPatched = primaryRef.value === "Travel to" && fallbackRef.stringIndex === primaryRef.stringIndex;
  if (alreadyPatched) {
    return {
      dedicatedLabelIndex: primaryRef.stringIndex,
      fallbackRefOffset: methodBody.codeStart + fallbackRef.instruction.offset + 1,
      fallbackRefSize: fallbackRef.instruction.size - 1,
      alreadyPatched: true,
    };
  }

  if (primaryRef.value !== "Dungeon" && primaryRef.value !== "Travel to") {
    throw new PatchError(`Unexpected primary door label text: ${primaryRef.value}`);
  }
  if (fallbackRef.value !== "Dungeon") {
    throw new PatchError(`Unexpected fallback door label text: ${fallbackRef.value}`);
  }

  return {
    dedicatedLabelIndex: primaryRef.stringIndex,
    fallbackRefOffset: methodBody.codeStart + fallbackRef.instruction.offset + 1,
    fallbackRefSize: fallbackRef.instruction.size - 1,
    alreadyPatched: false,
  };
}

function patchDungeonDoorLabel(swfPath: string, verify: boolean): void {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const refs = findDoorLabelRefs(swfPath);

  if (refs.alreadyPatched) {
    console.log(`Dungeon door labels already say "Travel to" in ${path.basename(swfPath)}`);
    return;
  }

  if (verify) {
    throw new PatchError(`Dungeon door labels still need patching in ${path.basename(swfPath)}`);
  }

  const patches: BytePatch[] = [];
  const labelText = abc.stringValues[refs.dedicatedLabelIndex];

  if (labelText === "Dungeon") {
    const newText = "Travel to";
    const newBytes = Buffer.from(newText, "utf8");
    patches.push({
      key: "dungeon-door-label-text",
      start: abc.stringLenPositions[refs.dedicatedLabelIndex],
      end: abc.stringDataPositions[refs.dedicatedLabelIndex] + Buffer.byteLength(labelText, "utf8"),
      data: Buffer.concat([writeU30(newBytes.length), newBytes]),
      detail: `"${labelText}" -> "${newText}"`,
    });
  } else if (labelText !== "Travel to") {
    throw new PatchError(`Unexpected dedicated door label text: ${labelText}`);
  }

  const fallbackOperand = writeU30(refs.dedicatedLabelIndex);
  if (fallbackOperand.length !== refs.fallbackRefSize) {
    throw new PatchError(
      `Cannot retarget fallback door label operand without changing bytecode size (${refs.fallbackRefSize} -> ${fallbackOperand.length})`,
    );
  }
  patches.push({
    key: "dungeon-door-label-fallback-ref",
    start: refs.fallbackRefOffset,
    end: refs.fallbackRefOffset + refs.fallbackRefSize,
    data: fallbackOperand,
    detail: "fallback label ref -> dedicated Travel to string",
  });

  if (patches.length === 0) {
    console.log(`Dungeon door labels already say "Travel to" in ${path.basename(swfPath)}`);
    return;
  }

  ensureBackup(swfPath);
  const { body, delta } = applyPatchesToBody(ctx.body, patches);
  writeSwf(ctx, body, delta);
  console.log(`Patched ${path.basename(swfPath)} dungeon door labels: ${patches.map((patch) => patch.detail).join(", ")}`);
}

try {
  const { swfPath, verify } = parseArgs(process.argv);
  patchDungeonDoorLabel(swfPath, verify);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
