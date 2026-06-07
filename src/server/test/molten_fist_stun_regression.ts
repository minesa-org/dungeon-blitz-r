import { strict as assert } from "assert";
import * as fs from "fs";
import * as path from "path";
import { parseSwz } from "../scripts/swzPatchUtils";

const ROOT = path.resolve(__dirname, "..", "..");
const XML_DIR = path.join(ROOT, "client", "content", "xml");
const CBQ_DIR = path.join(ROOT, "client", "content", "localhost", "p", "cbq");
const MOLTEN_FIST_STUN_BUFF = "Dazed";

function blockByPattern(xml: string, pattern: RegExp, label: string): string {
  const match = xml.match(pattern);
  assert(match, `${label} block must exist`);
  return match[0];
}

function powerBlock(xml: string, powerName: string): string {
  return blockByPattern(xml, new RegExp(`<Power PowerName="${powerName}">[\\s\\S]*?<\\/Power>`), powerName);
}

function buffBlock(xml: string, buffName: string): string {
  return blockByPattern(xml, new RegExp(`<BuffType BuffName="${buffName}">[\\s\\S]*?<\\/BuffType>`), buffName);
}

function tagValue(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? null;
}

function targetBuffs(block: string): string[] {
  return (tagValue(block, "AddTargetBuff") ?? "").split(",").map((buff) => buff.trim()).filter(Boolean);
}

function assertMoltenFistStunData(powerXml: string, buffXml: string, label: string): void {
  const stunBlock = buffBlock(buffXml, MOLTEN_FIST_STUN_BUFF);
  assert.equal(tagValue(stunBlock, "Duration"), "1000", `${label}: ${MOLTEN_FIST_STUN_BUFF} Duration`);
  assert.equal(tagValue(stunBlock, "Effect"), "Stunned", `${label}: ${MOLTEN_FIST_STUN_BUFF} Effect`);
  assert(!buffXml.includes("MoltenFistStun1000"), `${label}: custom Molten Fist stun buff must not be present`);

  for (const powerName of ["MoltenFist", "MoltenFist7", "MoltenFist8", "MoltenFist9", "MoltenFist10"]) {
    const buffs = targetBuffs(powerBlock(powerXml, powerName));
    assert(buffs.includes(MOLTEN_FIST_STUN_BUFF), `${label}: ${powerName} must use the 1 second Molten Fist stun`);
    assert(!buffs.includes("StunStrike2000"), `${label}: ${powerName} must not use the shared 2 second stun`);
  }

  for (const powerName of ["MoltenFist1", "MoltenFist2", "MoltenFist3", "MoltenFist4", "MoltenFist5", "MoltenFist6"]) {
    const buffs = targetBuffs(powerBlock(powerXml, powerName));
    assert(!buffs.includes("StunStrike2000"), `${label}: ${powerName} must not use the shared 2 second stun`);
  }
}

function swzChunk(swzPath: string, marker: string): string {
  const chunk = parseSwz(swzPath).chunks.find((entry) => entry.xml.includes(marker));
  assert(chunk, `${path.basename(swzPath)} must contain ${marker}`);
  return chunk.xml;
}

assertMoltenFistStunData(
  fs.readFileSync(path.join(XML_DIR, "PlayerPowerTypes.xml"), "utf8"),
  fs.readFileSync(path.join(XML_DIR, "PlayerBuffTypes.xml"), "utf8"),
  "loose XML",
);

for (const fileName of ["Game.swz", "Game.en.swz", "Game.tr.swz"]) {
  const swzPath = path.join(CBQ_DIR, fileName);
  assertMoltenFistStunData(
    swzChunk(swzPath, "<PlayerPowerTypes"),
    swzChunk(swzPath, "<PlayerBuffTypes"),
    fileName,
  );
}

console.log("molten_fist_stun_regression passed");
