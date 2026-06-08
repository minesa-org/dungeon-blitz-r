import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { hasViperbladeBuffReapplyGuard } from "../scripts/patch-dungeonblitz-viperblade-buff-reapply-guard";
import { parseSwz } from "../scripts/swzPatchUtils";

const ROOT = path.resolve(__dirname, "..", "..");
const XML_DIR = path.join(ROOT, "client", "content", "xml");
const CBQ_DIR = path.join(ROOT, "client", "content", "localhost", "p", "cbq");
const DUNGEON_BLITZ_SWF = path.join(ROOT, "client", "content", "localhost", "p", "cbp", "DungeonBlitz.swf");

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
    assert(commaValues(block, "AddTargetBuff").includes("ViperbladePoisonStrike"), `${label}: ${powerName} inflicts stack-capped Viperblade poison`);
    assert(!commaValues(block, "AddTargetBuff").includes("PoisonStrike"), `${label}: ${powerName} no longer uses the globally stacking poison`);
  }

  for (const powerName of ["RapierMelee", "SaberMelee"]) {
    assert(basicAttackPowers.includes(powerName), `${label}: ${powerName} is guarded as a close basic attack`);
    const buffs = commaValues(powerBlock(powerXml, powerName), "AddTargetBuff");
    assert(buffs.includes("ViperbladeBleeding"), `${label}: ${powerName} inflicts stack-capped Viperblade bleeding`);
    assert(!buffs.includes("Bleeding"), `${label}: ${powerName} no longer uses the globally stacking bleed`);
  }
}

function buffBlock(xml: string, buffName: string): string {
  return blockByPattern(xml, new RegExp(`<BuffType BuffName="${buffName}">[\\s\\S]*?<\\/BuffType>`), buffName);
}

function assertRogueViperbladeBuffTypes(buffXml: string, label: string): void {
  for (const buffName of ["ViperbladePoisonStrike", "ViperbladeBleeding"]) {
    const block = buffBlock(buffXml, buffName);
    assert.equal(tagValue(block, "Duration"), "5000", `${label}: ${buffName} keeps the 5s duration`);
    assert.equal(tagValue(block, "StackCount"), "1", `${label}: ${buffName} caps at one stack per target`);
  }

  assert.equal(tagValue(buffBlock(buffXml, "PoisonStrike"), "StackCount"), "3", `${label}: global poison stack count is unchanged`);
  assert.equal(tagValue(buffBlock(buffXml, "Bleeding"), "StackCount"), "15", `${label}: global bleed stack count is unchanged`);
}

function assertRogueViperbladePowerMods(powerModXml: string, label: string): void {
  for (const modName of ["PoisonDmg1", "ContactPoison1", "InsidiousPoison1"]) {
    assert(commaValues(modBlock(powerModXml, modName), "BuffName").includes("ViperbladePoisonStrike"), `${label}: ${modName} affects Viperblade poison`);
  }

  assert(commaValues(modBlock(powerModXml, "BleedDmg1"), "BuffName").includes("ViperbladeBleeding"), `${label}: BleedDmg affects Viperblade bleeding`);
  assert(!commaValues(modBlock(powerModXml, "BleedMax1"), "BuffName").includes("ViperbladeBleeding"), `${label}: BleedMax does not increase Viperblade bleed stacks`);
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
assertRogueViperbladePowerMods(fs.readFileSync(path.join(XML_DIR, "PowerModTypes.xml"), "utf8"), "loose XML");
assertRogueViperbladeBuffTypes(fs.readFileSync(path.join(XML_DIR, "PlayerBuffTypes.xml"), "utf8"), "loose XML");

for (const fileName of ["Game.swz", "Game.en.swz", "Game.tr.swz"]) {
  const swzPath = path.join(CBQ_DIR, fileName);
  assertRogueViperbladeStatusEffects(
    swzChunk(swzPath, "<PlayerPowerTypes"),
    swzChunk(swzPath, "<PowerModTypes"),
    fileName,
  );
  assertRogueViperbladePowerMods(swzChunk(swzPath, "<PowerModTypes"), fileName);
  assertRogueViperbladeBuffTypes(swzChunk(swzPath, "<PlayerBuffTypes"), fileName);
}

assert(hasViperbladeBuffReapplyGuard(DUNGEON_BLITZ_SWF), "DungeonBlitz.swf skips Viperblade poison/bleed reapplication while active");

console.log("rogue_viperblade_status_effects_regression passed");
