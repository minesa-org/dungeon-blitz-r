import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "../scripts/swzPatchUtils";
import {
  hasHailstoneEmbraceSelfBuffs,
  patchHailstoneEmbraceSelfBuff,
} from "../scripts/patch_gameswz_hailstone_embrace";

function sourcePlayerPowerTypesPath(): string {
  return path.resolve(__dirname, "..", "..", "client", "content", "xml", "PlayerPowerTypes.xml");
}

function gameSwzPaths(): string[] {
  const cbqDir = path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbq");
  return ["Game.swz", "Game.en.swz", "Game.tr.swz"]
    .map((name) => path.join(cbqDir, name))
    .filter((swzPath) => fs.existsSync(swzPath));
}

function getGameSwzPlayerPowerTypes(swzPath: string): string {
  const ctx = parseSwz(swzPath);
  const chunk = ctx.chunks.find((entry) => entry.xml.includes("<PlayerPowerTypes"));
  assert.ok(chunk, `${path.basename(swzPath)} should contain PlayerPowerTypes`);
  return chunk.xml;
}

function assertHailstoneUsesSelfBuffs(xml: string, label: string): void {
  assert.equal(
    hasHailstoneEmbraceSelfBuffs(xml),
    true,
    `${label} should apply IceArmor as a self stance buff so basic attack overrides and cancellation work`
  );
  assert.equal(
    patchHailstoneEmbraceSelfBuff(xml).stats.selfBuffsUpdated,
    0,
    `${label} should already be patched`
  );
}

function main(): void {
  assertHailstoneUsesSelfBuffs(fs.readFileSync(sourcePlayerPowerTypesPath(), "utf8"), "source XML");
  const swzFiles = gameSwzPaths();
  assert.ok(swzFiles.length > 0, "at least one Game SWZ should exist");
  for (const swzPath of swzFiles) {
    assertHailstoneUsesSelfBuffs(getGameSwzPlayerPowerTypes(swzPath), path.basename(swzPath));
  }
  console.log("hailstone_embrace_regression: ok");
}

try {
  main();
} catch (error) {
  console.error("hailstone_embrace_regression: failed");
  console.error(error);
  process.exitCode = 1;
}
