import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "../scripts/swzPatchUtils";
import { patchRewardpackGoldValues } from "../scripts/patch_gameswz_rewardpack_gold";

const EXPECTED_GOLD_VALUES = ["1000000", "500000", "250000", "500000", "250000", "1000000"];

function sourceRewardpackTypesPath(): string {
  return path.resolve(__dirname, "..", "..", "client", "content", "xml", "RewardpackTypes.xml");
}

function gameSwzPath(): string {
  return path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbq", "Game.swz");
}

function extractGoldValues(xml: string): string[] {
  return Array.from(xml.matchAll(/<RewardItem>Gold<\/RewardItem>\s*<Value>(\d+)<\/Value>/g), (match) => match[1]);
}

function assertCorrectGoldValues(xml: string, label: string): void {
  assert.deepEqual(extractGoldValues(xml), EXPECTED_GOLD_VALUES, `${label} should use 250k/500k/1m trove gold values`);
  assert.equal(
    patchRewardpackGoldValues(xml).stats.replacements,
    0,
    `${label} rewardpack gold patch should be idempotent`,
  );
}

function getGameSwzRewardpackTypes(): string {
  const ctx = parseSwz(gameSwzPath());
  const chunk = ctx.chunks.find((entry) => entry.xml.includes("<RewardpackTypes"));
  assert.ok(chunk, "Game.swz should contain RewardpackTypes");
  return chunk.xml;
}

function main(): void {
  assertCorrectGoldValues(fs.readFileSync(sourceRewardpackTypesPath(), "utf8"), "source XML");
  assertCorrectGoldValues(getGameSwzRewardpackTypes(), "Game.swz");
  console.log("rewardpack_gold_regression: ok");
}

main();
