import * as path from "path";
import { patchDragonSoulCopyPower } from "./patch-dungeonblitz-dragon-soul-copy-power";

const DEFAULT_SWF = path.resolve(
  __dirname,
  "..",
  "..",
  "client",
  "content",
  "localhost",
  "p",
  "cbp",
  "DungeonBlitz.swf",
);

function parseArgs(argv: string[]): { swfPath: string; verify: boolean } {
  let swfPath = DEFAULT_SWF;
  let verify = false;

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--swf" || arg === "-s") {
      swfPath = path.resolve(argv[++index] || "");
      continue;
    }
    if (arg === "--verify" || arg === "--dry-run") {
      verify = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log([
        "Usage:",
        "  npm exec tsx src/server/scripts/patch-dungeonblitz-dragon-soul-safe-summon.ts [--verify] [--swf <path>]",
        "",
        "Compatibility wrapper for the Dragon Soul copy-power patch.",
        "Dragon Soul must copy triggering Fire Brand projectiles only; this script no longer",
        "restores the old DragonSoulShotN-only behavior.",
      ].join("\n"));
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { swfPath, verify };
}

const { swfPath, verify } = parseArgs(process.argv);
patchDragonSoulCopyPower(swfPath, verify);
