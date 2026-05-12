import * as fs from "fs";
import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

const SPECTRAL_GRASP_POWER_RE = /^SpectralGrasp(?:\d+)?$/;

export type SpectralGraspAoePatchStats = {
  powerBlocks: number;
  targetMethodsUpdated: number;
  descriptionsUpdated: number;
  upgradeDescriptionsUpdated: number;
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

export function patchSpectralGraspAoe(xml: string): { xml: string; stats: SpectralGraspAoePatchStats } {
  const stats: SpectralGraspAoePatchStats = {
    powerBlocks: 0,
    targetMethodsUpdated: 0,
    descriptionsUpdated: 0,
    upgradeDescriptionsUpdated: 0,
  };

  const patchedXml = xml.replace(
    /<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g,
    (powerBlock: string, powerName: string) => {
      if (!SPECTRAL_GRASP_POWER_RE.test(powerName)) {
        return powerBlock;
      }

      stats.powerBlocks += 1;
      let patchedBlock = powerBlock.replace(
        /<TargetMethod>RangedStrike<\/TargetMethod>/,
        () => {
          stats.targetMethodsUpdated += 1;
          return "<TargetMethod>RangedAoE</TargetMethod>";
        },
      );

      patchedBlock = patchedBlock.replace(
        /<Description>Ranged attack that applies Curse and Armor Bane<\/Description>/,
        () => {
          stats.descriptionsUpdated += 1;
          return "<Description>Area attack that applies Curse and Armor Bane</Description>";
        },
      );

      patchedBlock = patchedBlock.replace(
        /<Description>Ranged attack that applies Curse, Armor Bane, and Weaken<\/Description>/,
        () => {
          stats.descriptionsUpdated += 1;
          return "<Description>Area attack that applies Curse, Armor Bane, and Weaken</Description>";
        },
      );

      patchedBlock = patchedBlock.replace(
        /<Description>Ranged attack that applies Curse, Armor Bane, Weaken, and Poison<\/Description>/,
        () => {
          stats.descriptionsUpdated += 1;
          return "<Description>Area attack that applies Curse, Armor Bane, Weaken, and Poison</Description>";
        },
      );

      patchedBlock = patchedBlock.replace(
        /<UpgradeDescription>Adds Weaken\. Increased Damage #olddmg#<\/UpgradeDescription>/,
        () => {
          stats.upgradeDescriptionsUpdated += 1;
          return "<UpgradeDescription>Adds Weaken. Area damage. Increased Damage #olddmg#</UpgradeDescription>";
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

export function hasSpectralGraspAoe(xml: string): boolean {
  let checkedBlocks = 0;
  let allBlocksAreAoe = true;

  xml.replace(/<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g, (powerBlock: string, powerName: string) => {
    if (!SPECTRAL_GRASP_POWER_RE.test(powerName)) {
      return powerBlock;
    }

    checkedBlocks += 1;
    if (!powerBlock.includes("<TargetMethod>RangedAoE</TargetMethod>")) {
      allBlocksAreAoe = false;
    }

    return powerBlock;
  });

  return checkedBlocks === 11 && allBlocksAreAoe;
}

function logStats(stats: SpectralGraspAoePatchStats): void {
  console.log(
    [
      `Spectral Grasp powers: ${stats.powerBlocks}`,
      `target methods updated: ${stats.targetMethodsUpdated}`,
      `descriptions updated: ${stats.descriptionsUpdated}`,
      `upgrade descriptions updated: ${stats.upgradeDescriptionsUpdated}`,
    ].join(", "),
  );
}

function patchSourceXml(xmlPath: string, verifyOnly: boolean): SpectralGraspAoePatchStats {
  const original = fs.readFileSync(xmlPath, "utf8");
  const patched = patchSpectralGraspAoe(original);
  console.log(`XML: ${xmlPath}`);
  logStats(patched.stats);

  if (!hasSpectralGraspAoe(patched.xml)) {
    throw new SwzPatchError("Source XML verification failed");
  }

  if (!verifyOnly && patched.xml !== original) {
    fs.writeFileSync(xmlPath, patched.xml, "utf8");
  }

  return patched.stats;
}

function patchGameSwz(swzPath: string, verifyOnly: boolean): SpectralGraspAoePatchStats {
  const ctx = parseSwz(swzPath);
  const chunk = ctx.chunks.find((entry) => entry.xml.includes("<PlayerPowerTypes"));
  if (!chunk) {
    throw new SwzPatchError("PlayerPowerTypes chunk not found in Game.swz");
  }

  const original = chunk.xml;
  const patched = patchSpectralGraspAoe(original);
  console.log(`SWZ: ${swzPath}`);
  logStats(patched.stats);

  if (!hasSpectralGraspAoe(patched.xml)) {
    throw new SwzPatchError("Game.swz verification failed");
  }

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
      xmlStats.targetMethodsUpdated +
      xmlStats.descriptionsUpdated +
      xmlStats.upgradeDescriptionsUpdated +
      swzStats.targetMethodsUpdated +
      swzStats.descriptionsUpdated +
      swzStats.upgradeDescriptionsUpdated;

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
