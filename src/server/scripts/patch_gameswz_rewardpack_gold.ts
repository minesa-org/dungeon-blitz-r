import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

const GOLD_VALUE_REPLACEMENTS = new Map<string, string>([
  ["3000000", "1000000"],
  ["1500000", "500000"],
  ["750000", "250000"],
]);

type RewardpackGoldPatchStats = {
  rewardpackChunkFound: boolean;
  replacements: number;
};

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

export function patchRewardpackGoldValues(xml: string): { xml: string; stats: RewardpackGoldPatchStats } {
  let replacements = 0;
  const patchedXml = xml.replace(
    /(<RewardItem>Gold<\/RewardItem>\s*<Value>)(\d+)(<\/Value>)/g,
    (match: string, prefix: string, rawValue: string, suffix: string) => {
      const replacement = GOLD_VALUE_REPLACEMENTS.get(rawValue);
      if (!replacement) {
        return match;
      }
      replacements += 1;
      return `${prefix}${replacement}${suffix}`;
    },
  );

  return {
    xml: patchedXml,
    stats: {
      rewardpackChunkFound: true,
      replacements,
    },
  };
}

function patchGameSwz(swzPath: string, verifyOnly: boolean): RewardpackGoldPatchStats {
  const ctx = parseSwz(swzPath);
  const rewardpackChunk = ctx.chunks.find((chunk) => chunk.xml.includes("<RewardpackTypes"));
  if (!rewardpackChunk) {
    throw new SwzPatchError("RewardpackTypes chunk not found in Game.swz");
  }

  const patched = patchRewardpackGoldValues(rewardpackChunk.xml);
  if (!verifyOnly && patched.stats.replacements > 0) {
    ensureBackup(swzPath);
    rewardpackChunk.xml = patched.xml;
    writeSwz(ctx);
  }

  return patched.stats;
}

function main(): void {
  const args = process.argv.slice(2);
  const swzPath = resolveArgPath(args, "--swz-path", defaultGameSwzPath());
  const verifyOnly = hasFlag(args, "--verify");
  const stats = patchGameSwz(swzPath, verifyOnly);

  console.log(`SWZ: ${swzPath}`);
  console.log(`RewardpackTypes found: ${stats.rewardpackChunkFound}`);
  console.log(`Gold values updated: ${stats.replacements}`);

  if (verifyOnly && stats.replacements > 0) {
    throw new SwzPatchError("Game.swz verification failed");
  }
}

if (require.main === module) {
  main();
}
