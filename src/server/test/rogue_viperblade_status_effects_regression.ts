import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "../scripts/swzPatchUtils";

const ROOT = path.resolve(__dirname, "..", "..");
const XML_DIR = path.join(ROOT, "client", "content", "xml");
const CBQ_DIR = path.join(ROOT, "client", "content", "localhost", "p", "cbq");

function blockByPattern(xml: string, pattern: RegExp, label: string): string {
  const match = xml.match(pattern);
  assert(match, `${label} block must exist`);
  return match[0];
}

function powerBlock(xml: string, powerName: string): string {
  return blockByPattern(xml, new RegExp(`<Power PowerName="${powerName}">[\\s\\S]*?<\\/Power>`), powerName);
}

function modBlock(xml: string, modName: string): string {
  return blockByPattern(xml, new RegExp(`<PowerModType>\\s*<ModName>${modName}<\\/ModName>[\\s\\S]*?<\\/PowerModType>`), modName);
}

function tagValue(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? null;
}

function commaValues(block: string, tag: string): string[] {
  return (tagValue(block, tag) ?? "").split(",").map((part) => part.trim()).filter(Boolean);
}

function assertRogueViperbladeStatusEffects(powerXml: string, powerModXml: string, label: string): void {
  const basicAttackPowers = commaValues(modBlock(powerModXml, "RuneSwordMelee"), "PowerName");

  for (const powerName of ["PoisonDagger", "PoisonDagger1"]) {
    const block = powerBlock(powerXml, powerName);
    assert(basicAttackPowers.includes(tagValue(block, "BasePowerName") ?? powerName), `${label}: ${powerName} is guarded as a basic attack`);
    assert.equal(tagValue(block, "DamageType"), "Nature", `${label}: ${powerName} deals poison/nature damage`);
    assert(commaValues(block, "AddTargetBuff").includes("PoisonStrike"), `${label}: ${powerName} inflicts poison`);
  }

  for (const powerName of ["RapierMelee", "SaberMelee"]) {
    assert(basicAttackPowers.includes(powerName), `${label}: ${powerName} is guarded as a close basic attack`);
    assert(commaValues(powerBlock(powerXml, powerName), "AddTargetBuff").includes("Bleeding"), `${label}: ${powerName} inflicts bleeding`);
  }
}

function swzChunk(swzPath: string, marker: string): string {
  const chunk = parseSwz(swzPath).chunks.find((entry) => entry.xml.includes(marker));
  assert(chunk, `${path.basename(swzPath)} must contain ${marker}`);
  return chunk.xml;
}

assertRogueViperbladeStatusEffects(
  fs.readFileSync(path.join(XML_DIR, "PlayerPowerTypes.xml"), "utf8"),
  fs.readFileSync(path.join(XML_DIR, "PowerModTypes.xml"), "utf8"),
  "loose XML",
);

for (const fileName of ["Game.swz", "Game.en.swz", "Game.tr.swz"]) {
  const swzPath = path.join(CBQ_DIR, fileName);
  assertRogueViperbladeStatusEffects(
    swzChunk(swzPath, "<PlayerPowerTypes"),
    swzChunk(swzPath, "<PowerModTypes"),
    fileName,
  );
}

console.log("rogue_viperblade_status_effects_regression passed");
