import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "../scripts/swzPatchUtils";
import {
  hasFrozenWardCastAnimOnlyPatch,
  patchFrozenWardCastAnim,
} from "../scripts/patch_gameswz_frozen_ward_cast_anim";

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

function assertFrozenWardAnimOnly(xml: string, label: string): void {
  assert.equal(
    hasFrozenWardCastAnimOnlyPatch(xml),
    true,
    `${label} should use the shortened Frozen Ward cast animation and align freeze timing with the visual impact`,
  );
  assert.equal(
    patchFrozenWardCastAnim(xml).stats.castAnimsUpdated,
    0,
    `${label} should already be patched`,
  );
}

function main(): void {
  assertFrozenWardAnimOnly(fs.readFileSync(sourcePlayerPowerTypesPath(), "utf8"), "source XML");
  const swzFiles = gameSwzPaths();
  assert.ok(swzFiles.length > 0, "at least one Game SWZ should exist");
  for (const swzPath of swzFiles) {
    assertFrozenWardAnimOnly(getGameSwzPlayerPowerTypes(swzPath), path.basename(swzPath));
  }
  console.log("frozen_ward_cast_anim_regression: ok");
}

try {
  main();
} catch (error) {
  console.error("frozen_ward_cast_anim_regression: failed");
  console.error(error);
  process.exitCode = 1;
}
