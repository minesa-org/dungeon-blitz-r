import * as path from "path";
import {
  applyPatchesToBody,
  BytePatch,
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

function patchDungeonDoorLabel(swfPath: string): void {
  const ctx = parseSwf(swfPath);
  const abc = parseAbc(ctx);
  const matches: number[] = [];

  for (let i = 1; i < abc.stringValues.length; i += 1) {
    if (abc.stringValues[i] === "Travel to") {
      matches.push(i);
    }
  }

  if (matches.length === 0 && abc.stringValues.some((value) => value === "Dungeon")) {
    console.log(`Dungeon door label already patched in ${path.basename(swfPath)}`);
    return;
  }

  if (matches.length !== 1) {
    throw new PatchError(`Expected exactly one "Travel to" string, found ${matches.length}`);
  }

  const stringIndex = matches[0];
  const newText = "Dungeon";
  const newBytes = Buffer.from(newText, "utf8");
  const patch: BytePatch = {
    key: "dungeon-door-label",
    start: abc.stringLenPositions[stringIndex],
    end: abc.stringDataPositions[stringIndex] + Buffer.byteLength("Travel to", "utf8"),
    data: Buffer.concat([writeU30(newBytes.length), newBytes]),
    detail: `"Travel to" -> "${newText}"`,
  };

  const { body, delta } = applyPatchesToBody(ctx.body, [patch]);
  writeSwf(ctx, body, delta);
  console.log(`Patched ${path.basename(swfPath)} dungeon door label: ${patch.detail}`);
}

try {
  patchDungeonDoorLabel(process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SWF_PATH);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
