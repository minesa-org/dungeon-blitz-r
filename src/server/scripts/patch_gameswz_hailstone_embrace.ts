import * as fs from "fs";
import * as path from "path";
import { ensureBackup, parseSwz, SwzPatchError, writeSwz } from "./swzPatchUtils";

type HailstonePatchStats = {
  selfBuffsUpdated: number;
  targetBuffsRemaining: number;
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

function resolveArgPath(args: string[], flag: string, defaultPath: string): string {
  const index = args.indexOf(flag);
  if (index < 0) {
    return defaultPath;
  }
  const value = args[index + 1];
  if (!value) {
    throw new SwzPatchError(`Missing value for ${flag}`);
  }
  return path.resolve(process.cwd(), value);
}

export function patchHailstoneEmbraceSelfBuff(xml: string): { xml: string; stats: HailstonePatchStats } {
  let selfBuffsUpdated = 0;
  const patchedXml = xml.replace(
    /<Power PowerName="HailstoneEmbrace(\d+)">([\s\S]*?)<\/Power>/g,
    (powerBlock: string, rank: string) => {
      const targetBuff = new RegExp(`<AddTargetBuff>Last:IceArmor${rank}<\\/AddTargetBuff>`);
      if (!targetBuff.test(powerBlock)) {
        return powerBlock;
      }
      selfBuffsUpdated += 1;
      return powerBlock.replace(
        targetBuff,
        `<AddSelfBuff>IceArmor${rank}</AddSelfBuff>`
      );
    }
  );

  const targetBuffsRemaining = (
    patchedXml.match(/<Power PowerName="HailstoneEmbrace\d+">[\s\S]*?<AddTargetBuff>Last:IceArmor\d+<\/AddTargetBuff>[\s\S]*?<\/Power>/g) ??
    []
  ).length;

  return {
    xml: patchedXml,
    stats: {
      selfBuffsUpdated,
      targetBuffsRemaining
    }
  };
}

export function hasHailstoneEmbraceSelfBuffs(xml: string): boolean {
  const patched = patchHailstoneEmbraceSelfBuff(xml);
  const selfBuffCount = (
    patched.xml.match(/<Power PowerName="HailstoneEmbrace\d+">[\s\S]*?<AddSelfBuff>IceArmor\d+<\/AddSelfBuff>[\s\S]*?<\/Power>/g) ??
    []
  ).length;
  return selfBuffCount === 10 && patched.stats.targetBuffsRemaining === 0;
}

function patchSourceXml(xmlPath: string, verifyOnly: boolean): HailstonePatchStats {
  const original = fs.readFileSync(xmlPath, "utf8");
  const patched = patchHailstoneEmbraceSelfBuff(original);
  if (!hasHailstoneEmbraceSelfBuffs(patched.xml)) {
    throw new SwzPatchError("source XML verification failed");
  }
  if (!verifyOnly && patched.xml !== original) {
    fs.writeFileSync(xmlPath, patched.xml, "utf8");
  }
  return patched.stats;
}

function patchGameSwz(swzPath: string, verifyOnly: boolean): HailstonePatchStats {
  const ctx = parseSwz(swzPath);
  const chunk = ctx.chunks.find((entry) => entry.xml.includes("<PlayerPowerTypes"));
  if (!chunk) {
    throw new SwzPatchError(`${path.basename(swzPath)} missing PlayerPowerTypes`);
  }

  const original = chunk.xml;
  const patched = patchHailstoneEmbraceSelfBuff(original);
  if (!hasHailstoneEmbraceSelfBuffs(patched.xml)) {
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
  const verifyOnly = args.includes("--verify");
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
    console.error(`[patch_gameswz_hailstone_embrace] ${message}`);
    process.exitCode = 1;
  }
}
