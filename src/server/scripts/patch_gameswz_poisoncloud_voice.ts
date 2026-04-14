import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

type Replacement = {
  label: string;
  oldValue: string;
  newValue: string;
};

const REPLACEMENTS: Replacement[] = [
  {
    label: "Poison Cloud voice",
    oldValue:
      "snd_pwr_mage_poisoncloud_staffraise,snd_pwr_mage_poisoncloud_vox[520]snd_pwr_mage_poisoncloud_attack",
    newValue:
      "snd_pwr_mage_poisoncloud_staffraise,snd_pwr_mage_poisoncloud_vox$[520]snd_pwr_mage_poisoncloud_attack",
  },
  {
    label: "Hail Storm voice",
    oldValue:
      "snd_pwr_mage_hailStorm_new__vox,snd_pwr_mage_hailStorm_new_jump[590]snd_pwr_mage_hailStorm_new_attack",
    newValue:
      "snd_pwr_mage_hailStorm_new__vox$,snd_pwr_mage_hailStorm_new_jump[590]snd_pwr_mage_hailStorm_new_attack",
  },
];

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

function resolveSwzPath(args: string[]): string {
  const idx = args.indexOf("--swz-path");
  if (idx !== -1 && idx + 1 < args.length) {
    return path.resolve(args[idx + 1]);
  }
  return defaultGameSwzPath();
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function countOccurrences(xml: string, value: string): number {
  if (!value) {
    return 0;
  }

  let count = 0;
  let index = 0;
  while ((index = xml.indexOf(value, index)) !== -1) {
    count += 1;
    index += value.length;
  }
  return count;
}

function patchMageGenderedCastSounds(
  xml: string,
): { xml: string; stats: Array<{ label: string; found: number; changed: number }> } {
  let updated = xml;
  const stats: Array<{ label: string; found: number; changed: number }> = [];

  for (const replacement of REPLACEMENTS) {
    const found = countOccurrences(updated, replacement.oldValue);
    if (found > 0) {
      updated = updated.split(replacement.oldValue).join(replacement.newValue);
    }
    stats.push({
      label: replacement.label,
      found,
      changed: found,
    });
  }

  return { xml: updated, stats };
}

function main(): number {
  const args = process.argv.slice(2);
  const swzPath = resolveSwzPath(args);
  const verifyOnly = hasFlag(args, "--verify") || hasFlag(args, "--dry-run");

  try {
    const ctx = parseSwz(swzPath);
    const chunk = ctx.chunks.find((entry) => entry.xml.includes('<PlayerPowerTypes'));
    if (!chunk) {
      throw new SwzPatchError("PlayerPowerTypes chunk not found in Game.swz");
    }

    const patched = patchMageGenderedCastSounds(chunk.xml);
    const totalChanged = patched.stats.reduce((sum, stat) => sum + stat.changed, 0);

    console.log(`SWZ: ${swzPath}`);
    for (const stat of patched.stats) {
      console.log(`${stat.label}: found=${stat.found} updated=${stat.changed}`);
    }

    if (!totalChanged) {
      console.log("No changes needed.");
      return 0;
    }

    if (verifyOnly) {
      console.log("Patch required.");
      return 0;
    }

    ensureBackup(swzPath);
    chunk.xml = patched.xml;
    writeSwz(ctx);
    console.log("Patch apply complete.");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Patch error: ${message}`);
    return 1;
  }
}

process.exit(main());
