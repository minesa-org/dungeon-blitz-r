import * as fs from "fs";
import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

const ROOT = path.resolve(__dirname, "..", "..");
const POWER_XML = path.join(ROOT, "client", "content", "xml", "PlayerPowerTypes.xml");
const POWER_MOD_XML = path.join(ROOT, "client", "content", "xml", "PowerModTypes.xml");
const BUFF_XML = path.join(ROOT, "client", "content", "xml", "PlayerBuffTypes.xml");
const CBQ_DIR = path.join(ROOT, "client", "content", "localhost", "p", "cbq");

const RANGED_POISON_POWERS = new Set(["PoisonDagger", "PoisonDagger1"]);
const CLOSE_BLEED_POWERS = new Set(["RapierMelee", "SaberMelee"]);
const BASE_POISON_BUFF = "PoisonStrike";
const BASE_BLEED_BUFF = "Bleeding";
const VIPER_POISON_BUFF = "ViperbladePoisonStrike";
const VIPER_BLEED_BUFF = "ViperbladeBleeding";
const VIPER_POISON_BUFF_ID = 740;
const VIPER_BLEED_BUFF_ID = 741;

type PatchStats = {
  powerBuffsChanged: number;
  buffTypesAdded: number;
  powerModBuffRefsAdded: number;
};

function defaultGameSwzPaths(): string[] {
  return ["Game.swz", "Game.en.swz", "Game.tr.swz"]
    .map((fileName) => path.join(CBQ_DIR, fileName))
    .filter((swzPath) => fs.existsSync(swzPath));
}

function mergeStats(...stats: PatchStats[]): PatchStats {
  return stats.reduce(
    (merged, current) => ({
      powerBuffsChanged: merged.powerBuffsChanged + current.powerBuffsChanged,
      buffTypesAdded: merged.buffTypesAdded + current.buffTypesAdded,
      powerModBuffRefsAdded: merged.powerModBuffRefsAdded + current.powerModBuffRefsAdded,
    }),
    { powerBuffsChanged: 0, buffTypesAdded: 0, powerModBuffRefsAdded: 0 },
  );
}

function addBuff(list: string, buffName: string): { value: string; changed: boolean } {
  const parts = list.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.includes(buffName)) {
    return { value: parts.join(","), changed: false };
  }
  return { value: [...parts, buffName].join(","), changed: true };
}

function replaceBuff(list: string, fromBuff: string, toBuff: string): { value: string; changed: boolean } {
  let changed = false;
  const parts = list.split(",").map((part) => {
    const trimmed = part.trim();
    if (trimmed === fromBuff) {
      changed = true;
      return toBuff;
    }
    return trimmed;
  }).filter(Boolean);

  if (!parts.includes(toBuff)) {
    parts.push(toBuff);
    changed = true;
  }

  return { value: Array.from(new Set(parts)).join(","), changed };
}

function ensureTargetBuff(block: string, fromBuff: string, toBuff: string): { block: string; changed: boolean } {
  const existing = block.match(/<AddTargetBuff>([^<]*)<\/AddTargetBuff>/);
  if (existing) {
    const patched = replaceBuff(existing[1], fromBuff, toBuff);
    if (!patched.changed) {
      return { block, changed: false };
    }
    return {
      block: block.replace(/<AddTargetBuff>[^<]*<\/AddTargetBuff>/, `<AddTargetBuff>${patched.value}</AddTargetBuff>`),
      changed: true,
    };
  }

  if (!block.includes("</PowerGroup>")) {
    throw new SwzPatchError("Power block is missing PowerGroup");
  }

  const newline = block.includes("\r\n") ? "\r\n" : "\n";
  return {
    block: block.replace("</PowerGroup>", `</PowerGroup>${newline}\t\t<AddTargetBuff>${toBuff}</AddTargetBuff>`),
    changed: true,
  };
}

export function patchRogueViperbladePowerXml(xml: string): { xml: string; stats: PatchStats } {
  const stats: PatchStats = { powerBuffsChanged: 0, buffTypesAdded: 0, powerModBuffRefsAdded: 0 };

  const patchedXml = xml.replace(/<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g, (block, powerName: string) => {
    if (RANGED_POISON_POWERS.has(powerName)) {
      const patched = ensureTargetBuff(block, BASE_POISON_BUFF, VIPER_POISON_BUFF);
      if (patched.changed) {
        stats.powerBuffsChanged += 1;
      }
      return patched.block;
    }

    if (CLOSE_BLEED_POWERS.has(powerName)) {
      const patched = ensureTargetBuff(block, BASE_BLEED_BUFF, VIPER_BLEED_BUFF);
      if (patched.changed) {
        stats.powerBuffsChanged += 1;
      }
      return patched.block;
    }

    return block;
  });

  return { xml: patchedXml, stats };
}

function buffBlock(xml: string, buffName: string): string {
  const match = xml.match(new RegExp(`<BuffType BuffName="${buffName}">[\\s\\S]*?<\\/BuffType>`));
  if (!match) {
    throw new SwzPatchError(`${buffName} block not found`);
  }
  return match[0];
}

function tagValue(block: string, tag: string): string | null {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? null;
}

function replaceTag(block: string, tag: string, value: string): string {
  return block.replace(new RegExp(`<${tag}>[\\s\\S]*?<\\/${tag}>`), `<${tag}>${value}</${tag}>`);
}

function upsertViperBuff(xml: string, baseBuff: string, viperBuff: string, buffId: number): { xml: string; changed: boolean } {
  let cloned = buffBlock(xml, baseBuff).replace(`BuffName="${baseBuff}"`, `BuffName="${viperBuff}"`);
  cloned = replaceTag(cloned, "BuffID", String(buffId));
  cloned = replaceTag(cloned, "StackCount", "1");
  const normalized = `\t${cloned}`;
  const existing = xml.match(new RegExp(`\\r?\\n\\s*<BuffType BuffName="${viperBuff}">[\\s\\S]*?\\r?\\n\\s*<\\/BuffType>`));

  if (existing) {
    const replacement = `\r\n${normalized}`;
    return {
      xml: xml.replace(existing[0], replacement),
      changed: existing[0] !== replacement,
    };
  }

  return {
    xml: xml.replace(buffBlock(xml, baseBuff), `${buffBlock(xml, baseBuff)}\r\n${normalized}`),
    changed: true,
  };
}

export function patchRogueViperbladeBuffXml(xml: string): { xml: string; stats: PatchStats } {
  const stats: PatchStats = { powerBuffsChanged: 0, buffTypesAdded: 0, powerModBuffRefsAdded: 0 };
  let next = xml;

  for (const [baseBuff, viperBuff, buffId] of [
    [BASE_POISON_BUFF, VIPER_POISON_BUFF, VIPER_POISON_BUFF_ID],
    [BASE_BLEED_BUFF, VIPER_BLEED_BUFF, VIPER_BLEED_BUFF_ID],
  ] as const) {
    const patched = upsertViperBuff(next, baseBuff, viperBuff, buffId);
    if (patched.changed) {
      stats.buffTypesAdded += 1;
      next = patched.xml;
    }
  }

  return { xml: next, stats };
}

export function patchRogueViperbladePowerModXml(xml: string): { xml: string; stats: PatchStats } {
  const stats: PatchStats = { powerBuffsChanged: 0, buffTypesAdded: 0, powerModBuffRefsAdded: 0 };

  const patchedXml = xml.replace(/<PowerModType>[\s\S]*?<\/PowerModType>/g, (block) => {
    const modName = tagValue(block, "ModName") ?? "";
    const buffName = tagValue(block, "BuffName");
    const buffProperty = tagValue(block, "BuffProperty");
    if (!buffName) {
      return block;
    }

    let patched = { value: buffName, changed: false };
    if (buffName.split(",").map((part) => part.trim()).includes(BASE_POISON_BUFF)) {
      patched = addBuff(buffName, VIPER_POISON_BUFF);
    } else if (modName.startsWith("BleedDmg") && buffProperty === "DoTDamage") {
      patched = addBuff(buffName, VIPER_BLEED_BUFF);
    }

    if (!patched.changed) {
      return block;
    }

    stats.powerModBuffRefsAdded += 1;
    return replaceTag(block, "BuffName", patched.value);
  });

  return { xml: patchedXml, stats };
}

function powerBlock(xml: string, powerName: string): string {
  const match = xml.match(new RegExp(`<Power PowerName="${powerName}">[\\s\\S]*?<\\/Power>`));
  if (!match) {
    throw new SwzPatchError(`${powerName} block not found`);
  }
  return match[0];
}

function targetBuffs(xml: string, powerName: string): string[] {
  const match = powerBlock(xml, powerName).match(/<AddTargetBuff>([^<]*)<\/AddTargetBuff>/);
  return (match?.[1] ?? "").split(",").map((part) => part.trim()).filter(Boolean);
}

export function assertRogueViperbladeStatusEffects(xml: string, label: string): void {
  for (const powerName of RANGED_POISON_POWERS) {
    const buffs = targetBuffs(xml, powerName);
    if (!buffs.includes(VIPER_POISON_BUFF) || buffs.includes(BASE_POISON_BUFF)) {
      throw new SwzPatchError(`${label}: ${powerName} must inflict only ${VIPER_POISON_BUFF}`);
    }
  }

  for (const powerName of CLOSE_BLEED_POWERS) {
    const buffs = targetBuffs(xml, powerName);
    if (!buffs.includes(VIPER_BLEED_BUFF) || buffs.includes(BASE_BLEED_BUFF)) {
      throw new SwzPatchError(`${label}: ${powerName} must inflict only ${VIPER_BLEED_BUFF}`);
    }
  }
}

export function assertRogueViperbladeBuffTypes(xml: string, label: string): void {
  for (const buffName of [VIPER_POISON_BUFF, VIPER_BLEED_BUFF]) {
    const block = buffBlock(xml, buffName);
    if (tagValue(block, "Duration") !== "5000" || tagValue(block, "StackCount") !== "1") {
      throw new SwzPatchError(`${label}: ${buffName} must last 5000ms and cap at one stack`);
    }
  }

  if (tagValue(buffBlock(xml, BASE_POISON_BUFF), "StackCount") !== "3") {
    throw new SwzPatchError(`${label}: ${BASE_POISON_BUFF} global stack count must remain unchanged`);
  }
  if (tagValue(buffBlock(xml, BASE_BLEED_BUFF), "StackCount") !== "15") {
    throw new SwzPatchError(`${label}: ${BASE_BLEED_BUFF} global stack count must remain unchanged`);
  }
}

export function assertRogueViperbladePowerMods(xml: string, label: string): void {
  for (const modName of ["PoisonDmg1", "ContactPoison1", "InsidiousPoison1"]) {
    const match = xml.match(new RegExp(`<PowerModType>\\s*<ModName>${modName}<\\/ModName>[\\s\\S]*?<\\/PowerModType>`));
    if (!match || !(tagValue(match[0], "BuffName") ?? "").split(",").includes(VIPER_POISON_BUFF)) {
      throw new SwzPatchError(`${label}: ${modName} must affect ${VIPER_POISON_BUFF}`);
    }
  }

  const bleedDmg = xml.match(/<PowerModType>\s*<ModName>BleedDmg1<\/ModName>[\s\S]*?<\/PowerModType>/);
  if (!bleedDmg || !(tagValue(bleedDmg[0], "BuffName") ?? "").split(",").includes(VIPER_BLEED_BUFF)) {
    throw new SwzPatchError(`${label}: BleedDmg1 must affect ${VIPER_BLEED_BUFF}`);
  }

  const bleedMax = xml.match(/<PowerModType>\s*<ModName>BleedMax1<\/ModName>[\s\S]*?<\/PowerModType>/);
  if (!bleedMax || (tagValue(bleedMax[0], "BuffName") ?? "").split(",").includes(VIPER_BLEED_BUFF)) {
    throw new SwzPatchError(`${label}: BleedMax1 must not raise ${VIPER_BLEED_BUFF} stack count`);
  }
}

function patchTextFile(filePath: string, patch: (xml: string) => { xml: string; stats: PatchStats }, assertPatched: (xml: string, label: string) => void, verifyOnly: boolean): PatchStats {
  const original = fs.readFileSync(filePath, "utf8");
  const patched = patch(original);
  const xmlToVerify = verifyOnly ? original : patched.xml;

  assertPatched(xmlToVerify, path.basename(filePath));

  if (!verifyOnly && patched.xml !== original) {
    fs.writeFileSync(filePath, patched.xml);
  }

  return patched.stats;
}

function patchSwz(swzPath: string, verifyOnly: boolean): PatchStats {
  const ctx = parseSwz(swzPath);
  const powerChunk = ctx.chunks.find((chunk) => chunk.xml.includes("<PlayerPowerTypes"));
  const powerModChunk = ctx.chunks.find((chunk) => chunk.xml.includes("<PowerModTypes"));
  const buffChunk = ctx.chunks.find((chunk) => chunk.xml.includes("<PlayerBuffTypes"));
  if (!powerChunk) {
    throw new SwzPatchError(`${path.basename(swzPath)} missing PlayerPowerTypes`);
  }
  if (!powerModChunk) {
    throw new SwzPatchError(`${path.basename(swzPath)} missing PowerModTypes`);
  }
  if (!buffChunk) {
    throw new SwzPatchError(`${path.basename(swzPath)} missing PlayerBuffTypes`);
  }

  const patchedPower = patchRogueViperbladePowerXml(powerChunk.xml);
  const patchedPowerMod = patchRogueViperbladePowerModXml(powerModChunk.xml);
  const patchedBuff = patchRogueViperbladeBuffXml(buffChunk.xml);
  const powerXmlToVerify = verifyOnly ? powerChunk.xml : patchedPower.xml;
  const powerModXmlToVerify = verifyOnly ? powerModChunk.xml : patchedPowerMod.xml;
  const buffXmlToVerify = verifyOnly ? buffChunk.xml : patchedBuff.xml;

  assertRogueViperbladeStatusEffects(powerXmlToVerify, path.basename(swzPath));
  assertRogueViperbladePowerMods(powerModXmlToVerify, path.basename(swzPath));
  assertRogueViperbladeBuffTypes(buffXmlToVerify, path.basename(swzPath));

  if (!verifyOnly && (patchedPower.xml !== powerChunk.xml || patchedPowerMod.xml !== powerModChunk.xml || patchedBuff.xml !== buffChunk.xml)) {
    ensureBackup(swzPath);
    powerChunk.xml = patchedPower.xml;
    powerModChunk.xml = patchedPowerMod.xml;
    buffChunk.xml = patchedBuff.xml;
    writeSwz(ctx);
  }

  return mergeStats(patchedPower.stats, patchedPowerMod.stats, patchedBuff.stats);
}

function main(): void {
  const verifyOnly = process.argv.includes("--verify");
  const swzPaths = defaultGameSwzPaths();
  const stats = mergeStats(
    patchTextFile(POWER_XML, patchRogueViperbladePowerXml, assertRogueViperbladeStatusEffects, verifyOnly),
    patchTextFile(POWER_MOD_XML, patchRogueViperbladePowerModXml, assertRogueViperbladePowerMods, verifyOnly),
    patchTextFile(BUFF_XML, patchRogueViperbladeBuffXml, assertRogueViperbladeBuffTypes, verifyOnly),
    ...swzPaths.map((swzPath) => patchSwz(swzPath, verifyOnly)),
  );
  console.log(JSON.stringify({ verifyOnly, swzPaths, stats }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[patch_gameswz_rogue_viperblade_status_effects] ${message}`);
    process.exit(1);
  }
}
