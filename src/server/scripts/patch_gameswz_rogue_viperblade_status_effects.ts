import * as fs from "fs";
import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

const ROOT = path.resolve(__dirname, "..", "..");
const POWER_XML = path.join(ROOT, "client", "content", "xml", "PlayerPowerTypes.xml");
const CBQ_DIR = path.join(ROOT, "client", "content", "localhost", "p", "cbq");

const RANGED_POISON_POWERS = new Set(["PoisonDagger", "PoisonDagger1"]);
const CLOSE_BLEED_POWERS = new Set(["RapierMelee", "SaberMelee"]);

type PatchStats = {
  rangedPoisonAdded: number;
  closeBleedAdded: number;
};

function defaultGameSwzPaths(): string[] {
  return ["Game.swz", "Game.en.swz", "Game.tr.swz"]
    .map((fileName) => path.join(CBQ_DIR, fileName))
    .filter((swzPath) => fs.existsSync(swzPath));
}

function mergeStats(...stats: PatchStats[]): PatchStats {
  return stats.reduce(
    (merged, current) => ({
      rangedPoisonAdded: merged.rangedPoisonAdded + current.rangedPoisonAdded,
      closeBleedAdded: merged.closeBleedAdded + current.closeBleedAdded,
    }),
    { rangedPoisonAdded: 0, closeBleedAdded: 0 },
  );
}

function addBuff(list: string, buffName: string): { value: string; changed: boolean } {
  const parts = list.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.includes(buffName)) {
    return { value: parts.join(","), changed: false };
  }
  return { value: [...parts, buffName].join(","), changed: true };
}

function ensureTargetBuff(block: string, buffName: string): { block: string; changed: boolean } {
  const existing = block.match(/<AddTargetBuff>([^<]*)<\/AddTargetBuff>/);
  if (existing) {
    const patched = addBuff(existing[1], buffName);
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
    block: block.replace("</PowerGroup>", `</PowerGroup>${newline}\t\t<AddTargetBuff>${buffName}</AddTargetBuff>`),
    changed: true,
  };
}

export function patchRogueViperbladePowerXml(xml: string): { xml: string; stats: PatchStats } {
  const stats: PatchStats = { rangedPoisonAdded: 0, closeBleedAdded: 0 };

  const patchedXml = xml.replace(/<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g, (block, powerName: string) => {
    if (RANGED_POISON_POWERS.has(powerName)) {
      const patched = ensureTargetBuff(block, "PoisonStrike");
      if (patched.changed) {
        stats.rangedPoisonAdded += 1;
      }
      return patched.block;
    }

    if (CLOSE_BLEED_POWERS.has(powerName)) {
      const patched = ensureTargetBuff(block, "Bleeding");
      if (patched.changed) {
        stats.closeBleedAdded += 1;
      }
      return patched.block;
    }

    return block;
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
    if (!targetBuffs(xml, powerName).includes("PoisonStrike")) {
      throw new SwzPatchError(`${label}: ${powerName} must inflict PoisonStrike`);
    }
  }

  for (const powerName of CLOSE_BLEED_POWERS) {
    if (!targetBuffs(xml, powerName).includes("Bleeding")) {
      throw new SwzPatchError(`${label}: ${powerName} must inflict Bleeding`);
    }
  }
}

function patchXmlFile(verifyOnly: boolean): PatchStats {
  const original = fs.readFileSync(POWER_XML, "utf8");
  const patched = patchRogueViperbladePowerXml(original);
  const xmlToVerify = verifyOnly ? original : patched.xml;

  assertRogueViperbladeStatusEffects(xmlToVerify, "PlayerPowerTypes.xml");

  if (!verifyOnly && patched.xml !== original) {
    fs.writeFileSync(POWER_XML, patched.xml);
  }

  return patched.stats;
}

function patchSwz(swzPath: string, verifyOnly: boolean): PatchStats {
  const ctx = parseSwz(swzPath);
  const powerChunk = ctx.chunks.find((chunk) => chunk.xml.includes("<PlayerPowerTypes"));
  if (!powerChunk) {
    throw new SwzPatchError(`${path.basename(swzPath)} missing PlayerPowerTypes`);
  }

  const patched = patchRogueViperbladePowerXml(powerChunk.xml);
  const xmlToVerify = verifyOnly ? powerChunk.xml : patched.xml;
  assertRogueViperbladeStatusEffects(xmlToVerify, path.basename(swzPath));

  if (!verifyOnly && patched.xml !== powerChunk.xml) {
    ensureBackup(swzPath);
    powerChunk.xml = patched.xml;
    writeSwz(ctx);
  }

  return patched.stats;
}

function main(): void {
  const verifyOnly = process.argv.includes("--verify");
  const swzPaths = defaultGameSwzPaths();
  const stats = mergeStats(patchXmlFile(verifyOnly), ...swzPaths.map((swzPath) => patchSwz(swzPath, verifyOnly)));
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
