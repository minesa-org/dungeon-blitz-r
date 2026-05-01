import * as fs from "fs";
import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

const SANCTUM_POWER_RE = /^Sanctum(?:\d+)?$/;
const GRAPHIC_TAGS = ["CastGfx", "FireGfx", "HitGfx"] as const;

type GraphicTag = (typeof GRAPHIC_TAGS)[number];

const SANCTUM_GFX: Record<GraphicTag, ReadonlyArray<string>> = {
  CastGfx: [
    "<AnimFile>SFX_3.swf</AnimFile>",
    "<AnimClass>a_SanctumCast</AnimClass>",
    "<AnimScale>.8</AnimScale>",
    "<FireAndForget>true</FireAndForget>",
  ],
  FireGfx: [
    "<AnimFile>SFX_3.swf</AnimFile>",
    "<AnimClass>a_SanctumFireFX</AnimClass>",
    "<AnimScale>.8</AnimScale>",
    "<FireAndForget>true</FireAndForget>",
  ],
  HitGfx: [
    "<AnimFile>SFX_3.swf</AnimFile>",
    "<AnimClass>a_SanctumHitReact</AnimClass>",
    "<AnimScale>0.7</AnimScale>",
    "<FireAndForget>true</FireAndForget>",
  ],
};

export type SanctumFxPatchStats = {
  powerBlocks: number;
  restoredTags: number;
  removedComboNames: number;
  updatedDescriptions: number;
  normalizedDescriptions: number;
};

function defaultSourceXmlPath(): string {
  return path.resolve(__dirname, "..", "..", "client", "content", "xml", "PlayerPowerTypes.xml");
}

function defaultGameSwzPath(): string {
  return path.resolve(
    __dirname,
    "..",
    "..",
    "client",
    "content",
    "localhost",
    "p",
    "cbq",
    "Game.swz",
  );
}

function resolveArgPath(args: string[], flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return path.resolve(args[idx + 1]);
  }
  return fallback;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function buildGfxBlock(tagName: GraphicTag, indent: string, lineEnding = "\n"): string {
  const innerIndent = `${indent}\t`;
  const body = SANCTUM_GFX[tagName].map((line) => `${innerIndent}${line}`);
  return [`${indent}<${tagName}>`, ...body, `${indent}</${tagName}>`].join(lineEnding);
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export function patchSanctumFxAndCombo(xml: string): { xml: string; stats: SanctumFxPatchStats } {
  const stats: SanctumFxPatchStats = {
    powerBlocks: 0,
    restoredTags: 0,
    removedComboNames: 0,
    updatedDescriptions: 0,
    normalizedDescriptions: 0,
  };

  const patchedXml = xml.replace(
    /<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g,
    (powerBlock: string, powerName: string) => {
      if (!SANCTUM_POWER_RE.test(powerName)) {
        return powerBlock;
      }

      stats.powerBlocks += 1;
      let patchedBlock = powerBlock;

      for (const tagName of GRAPHIC_TAGS) {
        const tagRe = new RegExp(
          `\\r?\\n([\\t ]*)<${tagName}(?:\\s*/>|>[\\s\\S]*?\\r?\\n[\\t ]*</${tagName}>)\\r?\\n`,
          "g",
        );
        patchedBlock = patchedBlock.replace(tagRe, (match: string, indent: string) => {
          const replacement = `\r\n${buildGfxBlock(tagName, indent, "\r\n")}\r\n`;
          if (match !== replacement) {
            stats.restoredTags += 1;
          }
          return replacement;
        });
      }

      patchedBlock = patchedBlock.replace(
        /\r?\n[\t ]*<ComboName>SanctumCombo<\/ComboName>/,
        () => {
          stats.removedComboNames += 1;
          return "";
        },
      );

      patchedBlock = patchedBlock.replace(
        /\r?\n([\t ]*)<Description>Heals allies in an area(?: and Blinds foes)?<\/Description>\r?\n/,
        (match: string, indent: string) => {
          if (match.includes("and Blinds foes")) {
            stats.updatedDescriptions += 1;
          } else if (match.includes("\r\n")) {
            stats.normalizedDescriptions += 1;
          }
          return `\n${indent}<Description>Heals allies in an area</Description>\n`;
        },
      );

      return patchedBlock;
    },
  );

  return {
    xml: patchedXml,
    stats,
  };
}

export function hasSanctumComboTrigger(xml: string): boolean {
  let found = false;
  xml.replace(/<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g, (powerBlock: string, powerName: string) => {
    if (SANCTUM_POWER_RE.test(powerName) && /<ComboName>SanctumCombo<\/ComboName>/.test(powerBlock)) {
      found = true;
    }
    return powerBlock;
  });
  return found;
}

export function hasRestoredSanctumFx(xml: string): boolean {
  let checkedBlocks = 0;
  let allTagsRestored = true;

  xml.replace(/<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g, (powerBlock: string, powerName: string) => {
    if (!SANCTUM_POWER_RE.test(powerName)) {
      return powerBlock;
    }

    checkedBlocks += 1;
    for (const tagName of GRAPHIC_TAGS) {
      if (!normalizeNewlines(powerBlock).includes(buildGfxBlock(tagName, "\t\t"))) {
        allTagsRestored = false;
      }
    }

    return powerBlock;
  });

  return checkedBlocks === 11 && allTagsRestored;
}

function logStats(stats: SanctumFxPatchStats): void {
  console.log(
    [
      `Sanctum powers: ${stats.powerBlocks}`,
      `gfx tags restored: ${stats.restoredTags}`,
      `combo triggers removed: ${stats.removedComboNames}`,
      `descriptions updated: ${stats.updatedDescriptions}`,
      `descriptions normalized: ${stats.normalizedDescriptions}`,
    ].join(", "),
  );
}

function patchSourceXml(xmlPath: string, verifyOnly: boolean): SanctumFxPatchStats {
  const original = fs.readFileSync(xmlPath, "utf8");
  const patched = patchSanctumFxAndCombo(original);
  console.log(`XML: ${xmlPath}`);
  logStats(patched.stats);

  if (!verifyOnly && patched.xml !== original) {
    fs.writeFileSync(xmlPath, patched.xml, "utf8");
  }

  return patched.stats;
}

function patchGameSwz(swzPath: string, verifyOnly: boolean): SanctumFxPatchStats {
  const ctx = parseSwz(swzPath);
  const chunk = ctx.chunks.find((entry) => entry.xml.includes("<PlayerPowerTypes"));
  if (!chunk) {
    throw new SwzPatchError("PlayerPowerTypes chunk not found in Game.swz");
  }

  const original = chunk.xml;
  const patched = patchSanctumFxAndCombo(original);
  console.log(`SWZ: ${swzPath}`);
  logStats(patched.stats);

  if (!verifyOnly && patched.xml !== original) {
    ensureBackup(swzPath);
    chunk.xml = patched.xml;
    writeSwz(ctx);
  }

  return patched.stats;
}

function main(): number {
  const args = process.argv.slice(2);
  const verifyOnly = hasFlag(args, "--verify") || hasFlag(args, "--dry-run");
  const xmlPath = resolveArgPath(args, "--xml-path", defaultSourceXmlPath());
  const swzPath = resolveArgPath(args, "--swz-path", defaultGameSwzPath());

  try {
    const xmlStats = patchSourceXml(xmlPath, verifyOnly);
    const swzStats = patchGameSwz(swzPath, verifyOnly);
    const totalChanges =
      xmlStats.restoredTags +
      xmlStats.removedComboNames +
      xmlStats.updatedDescriptions +
      xmlStats.normalizedDescriptions +
      swzStats.restoredTags +
      swzStats.removedComboNames +
      swzStats.updatedDescriptions +
      swzStats.normalizedDescriptions;

    if (totalChanges === 0) {
      console.log("No changes needed.");
    } else if (verifyOnly) {
      console.log("Patch required.");
    } else {
      console.log("Patch apply complete.");
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Patch error: ${message}`);
    return 1;
  }
}

if (require.main === module) {
  process.exit(main());
}
