import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "../scripts/swzPatchUtils";
import {
  hasRestoredSanctumFx,
  hasSanctumComboTrigger,
  patchSanctumFxAndCombo,
} from "../scripts/patch_gameswz_sanctum_fx";

const SANCTUM_POWER_RE = /^Sanctum(?:\d+)?$/;
const GRAPHIC_TAGS = ["CastGfx", "FireGfx", "HitGfx"] as const;

const EXPECTED_FX: Record<(typeof GRAPHIC_TAGS)[number], string[]> = {
  CastGfx: ["SFX_3.swf", "a_SanctumCast", ".8", "true"],
  FireGfx: ["SFX_3.swf", "a_SanctumFireFX", ".8", "true"],
  HitGfx: ["SFX_3.swf", "a_SanctumHitReact", "0.7", "true"],
};

function sourcePlayerPowerTypesPath(): string {
  return path.resolve(__dirname, "..", "..", "client", "content", "xml", "PlayerPowerTypes.xml");
}

function gameSwzPath(): string {
  return path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbq", "Game.swz");
}

function getSanctumBlocks(xml: string): string[] {
  const blocks: string[] = [];
  xml.replace(/<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g, (powerBlock: string, powerName: string) => {
    if (SANCTUM_POWER_RE.test(powerName)) {
      blocks.push(powerBlock.replace(/\r\n/g, "\n"));
    }
    return powerBlock;
  });
  return blocks;
}

function getTagBlock(powerBlock: string, tagName: string): string {
  const match = powerBlock.match(new RegExp(`<${tagName}>[\\s\\S]*?</${tagName}>`));
  assert.ok(match, `Sanctum should include ${tagName}`);
  return match[0];
}

function assertSanctumFxRestored(xml: string, label: string): void {
  const blocks = getSanctumBlocks(xml);
  assert.equal(blocks.length, 11, `${label} should define base Sanctum plus ranks 1-10`);
  assert.equal(hasRestoredSanctumFx(xml), true, `${label} should restore Sanctum gfx tags`);
  assert.equal(hasSanctumComboTrigger(xml), false, `${label} should not trigger SanctumCombo`);

  for (const block of blocks) {
    assert.doesNotMatch(block, /<ComboName>SanctumCombo<\/ComboName>/, `${label} should not run SanctumCombo`);
    assert.match(
      block,
      /<Description>Heals allies in an area<\/Description>/,
      `${label} should describe heal-only Sanctum`,
    );
    assert.doesNotMatch(block, /Blinds foes/, `${label} should not advertise disabled blind effect`);

    for (const tagName of GRAPHIC_TAGS) {
      const tagBlock = getTagBlock(block, tagName);
      for (const expected of EXPECTED_FX[tagName]) {
        assert.ok(tagBlock.includes(expected), `${label} ${tagName} should include ${expected}`);
      }
    }
  }

  const patched = patchSanctumFxAndCombo(xml);
  assert.equal(patched.stats.restoredTags, 0, `${label} Sanctum gfx restoration should be idempotent`);
  assert.equal(patched.stats.removedComboNames, 0, `${label} Sanctum combo suppression should be idempotent`);
  assert.equal(patched.stats.updatedDescriptions, 0, `${label} Sanctum description patch should be idempotent`);
  assert.equal(
    patched.stats.normalizedDescriptions,
    0,
    `${label} Sanctum description normalization should be idempotent`,
  );
}

function getGameSwzPlayerPowerTypes(): string {
  const ctx = parseSwz(gameSwzPath());
  const chunk = ctx.chunks.find((entry) => entry.xml.includes("<PlayerPowerTypes"));
  assert.ok(chunk, "Game.swz should contain PlayerPowerTypes");
  return chunk.xml;
}

function main(): void {
  assertSanctumFxRestored(fs.readFileSync(sourcePlayerPowerTypesPath(), "utf8"), "source XML");
  assertSanctumFxRestored(getGameSwzPlayerPowerTypes(), "Game.swz");
  console.log("sanctum_fx_regression: ok");
}

main();
