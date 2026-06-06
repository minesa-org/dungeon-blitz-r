import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "../scripts/swzPatchUtils";

const ROOT = path.resolve(__dirname, "..", "..");
const XML_DIR = path.join(ROOT, "client", "content", "xml");
const CBQ_DIR = path.join(ROOT, "client", "content", "localhost", "p", "cbq");

const EXPECTED_MOD_VALUES = new Map<string, string>([
  ["CritChance1", "+0.3%, +0.6%, +0.9%, +1.2%, +1.5%"],
  ["Opportunist1", "0.15%, 0.3%, 0.6%, 1.05%, 1.5%"],
  ["Dominate1", "0.15%, 0.3%, 0.45%, 0.75%, 1.2%"],
  ["CurseCrit1", "0.3%, 0.6%, 0.9%, 1.2%, 1.5%"],
]);

function blockByPattern(xml: string, pattern: RegExp, label: string): string {
  const match = xml.match(pattern);
  assert(match, `${label} block must exist`);
  return match[0];
}

function powerBlock(xml: string, powerName: string): string {
  return blockByPattern(
    xml,
    new RegExp(`<Power\\s+PowerName="${powerName}">[\\s\\S]*?<\\/Power>`),
    powerName,
  );
}

function modBlock(xml: string, modName: string): string {
  return blockByPattern(
    xml,
    new RegExp(`<PowerModType>\\s*<ModName>${modName}<\\/ModName>[\\s\\S]*?<\\/PowerModType>`),
    modName,
  );
}

function tagValue(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? null;
}

function descriptionValues(description: string): string {
  const marker = description.lastIndexOf(":,");
  assert.notEqual(marker, -1, `description should include a value-list separator: ${description}`);
  return description.slice(marker + 2).trim();
}

function assertCritChanceDisplays(playerPowerXml: string, powerModXml: string, label: string): void {
  assert.equal(
    tagValue(powerBlock(playerPowerXml, "CritChance"), "Description"),
    "+1.5% Critical Chance",
    `${label}: gear crit-chance proc description`,
  );

  for (const [modName, values] of EXPECTED_MOD_VALUES) {
    const description = tagValue(modBlock(powerModXml, modName), "Description");
    assert(description, `${label}: ${modName} description`);
    assert.equal(descriptionValues(description), values, `${label}: ${modName} visible crit values`);
  }
}

function swzChunk(swzPath: string, marker: string): string {
  const chunk = parseSwz(swzPath).chunks.find((entry) => entry.xml.includes(marker));
  assert(chunk, `${path.basename(swzPath)} must contain ${marker}`);
  return chunk.xml;
}

assertCritChanceDisplays(
  fs.readFileSync(path.join(XML_DIR, "PlayerPowerTypes.xml"), "utf8"),
  fs.readFileSync(path.join(XML_DIR, "PowerModTypes.xml"), "utf8"),
  "loose XML",
);

for (const fileName of ["Game.swz", "Game.en.swz", "Game.tr.swz"]) {
  const swzPath = path.join(CBQ_DIR, fileName);
  assertCritChanceDisplays(
    swzChunk(swzPath, "<PlayerPowerTypes"),
    swzChunk(swzPath, "<PowerModTypes"),
    fileName,
  );
}

console.log("crit_chance_display_regression passed");
