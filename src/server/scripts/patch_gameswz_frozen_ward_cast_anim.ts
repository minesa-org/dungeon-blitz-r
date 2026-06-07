import * as fs from "fs";
import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

const FROZEN_WARD_POWER_RE = /^FrozenWard(?:\d+)?$/;
export const FROZEN_WARD_CAST_ANIM = "RaiseArms2";
export const FROZEN_WARD_IMPACT_CAST_TIME_MS = 1450;

export type FrozenWardCastAnimPatchStats = {
  powerBlocks: number;
  castAnimsUpdated: number;
  castTimesUpdated: number;
  castTimesUnexpected: number;
  freezeBuffsChanged: number;
};

function defaultSourceXmlPath(): string {
  return path.resolve(__dirname, "..", "..", "client", "content", "xml", "PlayerPowerTypes.xml");
}

function defaultGameSwzPaths(): string[] {
  const cbqDir = path.resolve(__dirname, "..", "..", "client", "content", "localhost", "p", "cbq");
  return ["Game.swz", "Game.en.swz", "Game.tr.swz"]
    .map((name) => path.join(cbqDir, name))
    .filter((swzPath) => fs.existsSync(swzPath));
}

function resolveArgPath(args: string[], flag: string, fallback: string): string {
  const index = args.indexOf(flag);
  if (index < 0) {
    return fallback;
  }
  const value = args[index + 1];
  if (!value) {
    throw new SwzPatchError(`Missing value for ${flag}`);
  }
  return path.resolve(process.cwd(), value);
}

function resolveArgPaths(args: string[], flag: string, defaults: string[]): string[] {
  const resolved: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== flag) {
      continue;
    }
    const value = args[index + 1];
    if (!value) {
      throw new SwzPatchError(`Missing value for ${flag}`);
    }
    resolved.push(path.resolve(process.cwd(), value));
    index += 1;
  }
  return resolved.length > 0 ? resolved : defaults;
}

function expectedFreezeBuff(powerName: string): string {
  if (powerName === "FrozenWard10") {
    return "Sequence:FrozenWardDelay,Chilled42,Freeze2500,Weakened,Frigid,Chilblains,Chilblains";
  }
  if (powerName === "FrozenWard8" || powerName === "FrozenWard9") {
    return "Sequence:FrozenWardDelay,Chilled42,Freeze2500,Weakened,Chilblains,Chilblains";
  }
  if (["FrozenWard5", "FrozenWard6", "FrozenWard7"].includes(powerName)) {
    return "Sequence:FrozenWardDelay,Chilled42,Freeze2500,Weakened,Chilblains";
  }
  if (powerName === "FrozenWard4") {
    return "Sequence:FrozenWardDelay,Chilled42,Freeze2500,Chilblains";
  }
  return "Sequence:FrozenWardDelay,Chilled42,Freeze2500";
}

export function patchFrozenWardCastAnim(xml: string): { xml: string; stats: FrozenWardCastAnimPatchStats } {
  const stats: FrozenWardCastAnimPatchStats = {
    powerBlocks: 0,
    castAnimsUpdated: 0,
    castTimesUpdated: 0,
    castTimesUnexpected: 0,
    freezeBuffsChanged: 0,
  };

  const patchedXml = xml.replace(
    /<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g,
    (powerBlock: string, powerName: string) => {
      if (!FROZEN_WARD_POWER_RE.test(powerName)) {
        return powerBlock;
      }

      stats.powerBlocks += 1;
      if (!/<CastTime>0,(?:1900|1450)(?:,0)*<\/CastTime>/.test(powerBlock)) {
        stats.castTimesUnexpected += 1;
      }
      if (!powerBlock.includes(`<AddTargetBuff>${expectedFreezeBuff(powerName)}</AddTargetBuff>`)) {
        stats.freezeBuffsChanged += 1;
      }

      let patchedBlock = powerBlock.replace(/<CastAnim>SkyPower2<\/CastAnim>/, () => {
          stats.castAnimsUpdated += 1;
          return `<CastAnim>${FROZEN_WARD_CAST_ANIM}</CastAnim>`;
        });

      patchedBlock = patchedBlock.replace(/<CastTime>0,1900((?:,0)*)<\/CastTime>/, (_match, trailingZeros: string) => {
        stats.castTimesUpdated += 1;
        return `<CastTime>0,${FROZEN_WARD_IMPACT_CAST_TIME_MS}${trailingZeros}</CastTime>`;
      });

      return patchedBlock;
    },
  );

  return { xml: patchedXml, stats };
}

export function hasFrozenWardCastAnimOnlyPatch(xml: string): boolean {
  let matchingBlocks = 0;
  let totalBlocks = 0;
  let castTimesMatching = 0;
  let castTimesUnexpected = 0;
  let freezeBuffsChanged = 0;

  xml.replace(/<Power PowerName="([^"]+)">[\s\S]*?<\/Power>/g, (powerBlock: string, powerName: string) => {
    if (!FROZEN_WARD_POWER_RE.test(powerName)) {
      return powerBlock;
    }

    totalBlocks += 1;
    if (powerBlock.includes(`<CastAnim>${FROZEN_WARD_CAST_ANIM}</CastAnim>`)) {
      matchingBlocks += 1;
    }
    if (new RegExp(`<CastTime>0,${FROZEN_WARD_IMPACT_CAST_TIME_MS}(?:,0)*<\\/CastTime>`).test(powerBlock)) {
      castTimesMatching += 1;
    } else {
      castTimesUnexpected += 1;
    }
    if (!powerBlock.includes(`<AddTargetBuff>${expectedFreezeBuff(powerName)}</AddTargetBuff>`)) {
      freezeBuffsChanged += 1;
    }
    return powerBlock;
  });

  return totalBlocks === 11 && matchingBlocks === 11 && castTimesMatching === 11 && castTimesUnexpected === 0 && freezeBuffsChanged === 0;
}

function patchSourceXml(xmlPath: string, verifyOnly: boolean): FrozenWardCastAnimPatchStats {
  const original = fs.readFileSync(xmlPath, "utf8");
  const patched = patchFrozenWardCastAnim(original);
  if (!hasFrozenWardCastAnimOnlyPatch(patched.xml)) {
    throw new SwzPatchError("source XML verification failed");
  }
  if (!verifyOnly && patched.xml !== original) {
    fs.writeFileSync(xmlPath, patched.xml, "utf8");
  }
  return patched.stats;
}

function patchGameSwz(swzPath: string, verifyOnly: boolean): FrozenWardCastAnimPatchStats {
  const ctx = parseSwz(swzPath);
  const chunk = ctx.chunks.find((entry) => entry.xml.includes("<PlayerPowerTypes"));
  if (!chunk) {
    throw new SwzPatchError(`${path.basename(swzPath)} missing PlayerPowerTypes`);
  }

  const original = chunk.xml;
  const patched = patchFrozenWardCastAnim(original);
  if (!hasFrozenWardCastAnimOnlyPatch(patched.xml)) {
    throw new SwzPatchError(`${path.basename(swzPath)} verification failed`);
  }
  if (!verifyOnly && patched.xml !== original) {
    ensureBackup(swzPath);
    chunk.xml = patched.xml;
    writeSwz(ctx);
  }
  return patched.stats;
}

function main(): void {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes("--verify") || args.includes("--dry-run");
  const xmlPath = resolveArgPath(args, "--xml-path", defaultSourceXmlPath());
  const swzPaths = resolveArgPaths(args, "--swz-path", defaultGameSwzPaths());

  const xmlStats = patchSourceXml(xmlPath, verifyOnly);
  console.log(`XML: ${xmlPath}`);
  console.log(JSON.stringify(xmlStats));

  for (const swzPath of swzPaths) {
    const stats = patchGameSwz(swzPath, verifyOnly);
    console.log(`SWZ: ${swzPath}`);
    console.log(JSON.stringify(stats));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[patch_gameswz_frozen_ward_cast_anim] ${message}`);
    process.exitCode = 1;
  }
}
