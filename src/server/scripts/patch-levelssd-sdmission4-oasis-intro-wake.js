const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLASS_NAME = 'a_Room_SDMission4_05';
const DEFAULT_SWF = path.join('src', 'client', 'content', 'localhost', 'p', 'cam', 'LevelsSD.swf');

function parseArgs(argv) {
  const args = {
    swf: DEFAULT_SWF,
    ffdec: '',
    verify: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--swf' || arg === '--swf-path') {
      args.swf = argv[++index] || args.swf;
    } else if (arg === '--ffdec' || arg === '-f') {
      args.ffdec = argv[++index] || '';
    } else if (arg === '--verify' || arg === '--dry-run') {
      args.verify = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  console.log([
    'Usage:',
    '  node src/server/scripts/patch-levelssd-sdmission4-oasis-intro-wake.js [--verify] [--swf <path>] [--ffdec <path>]',
    '',
    'Patches LevelsSD a_Room_SDMission4_05 so the opening Oasis enemies wake and aggro',
    'even if the intro trigger or script-finish event is missed.'
  ].join('\n'));
}

function resolveRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function resolvePath(repoRoot, maybeRelative) {
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.join(repoRoot, maybeRelative);
}

function detectFfdec(repoRoot, preferred) {
  const candidates = [];
  if (preferred) {
    candidates.push(resolvePath(repoRoot, preferred));
  }

  candidates.push(
    path.join(repoRoot, 'build', 'tools', 'ffdec_25.0.0', 'ffdec-cli.exe'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_25.0.0', 'ffdec-cli.jar'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_25.0.0', 'ffdec.jar'),
    path.join(repoRoot, 'build', 'ffdec_24.0.1', 'ffdec-cli.exe'),
    path.join(repoRoot, 'build', 'ffdec_24.0.1', 'ffdec-cli.jar')
  );

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function runFfdec(ffdecPath, args) {
  const resolved = path.resolve(ffdecPath);
  const basename = path.basename(resolved).toLowerCase();

  if (basename.endsWith('.jar')) {
    execFileSync('java', ['-jar', resolved, '-cli', ...args], { stdio: 'inherit' });
    return;
  }

  execFileSync(resolved, ['-cli', ...args], { stdio: 'inherit' });
}

function exportRoomScript(ffdecPath, workRoot, swfPath) {
  fs.rmSync(workRoot, { recursive: true, force: true });
  fs.mkdirSync(workRoot, { recursive: true });
  runFfdec(ffdecPath, ['-selectclass', CLASS_NAME, '-export', 'script', workRoot, swfPath]);

  const roomPath = path.join(workRoot, 'scripts', `${CLASS_NAME}.as`);
  if (!fs.existsSync(roomPath)) {
    throw new Error(`FFDec export did not produce ${roomPath}`);
  }

  return roomPath;
}

function findMethodRange(source, methodName) {
  const marker = `public function ${methodName}(`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Could not find method ${methodName}`);
  }

  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error(`Could not find method body for ${methodName}`);
  }

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start, end: index + 1 };
      }
    }
  }

  throw new Error(`Could not find end of method ${methodName}`);
}

function replaceMethod(source, methodName, replacement) {
  const range = findMethodRange(source, methodName);
  return `${source.slice(0, range.start)}${replacement}${source.slice(range.end)}`;
}

function normalizeBlock(block, eol) {
  return block.trim().replace(/\n/g, eol);
}

function patchRoomSource(source) {
  try {
    verifyRoomSource(source, 'current source');
    return source;
  } catch (_error) {
    // Continue into the source patch path below.
  }

  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = source;

  if (!patched.includes('public var bIntroWakeStarted:Boolean;')) {
    const marker = `      public var Script_Intro:Array;${eol}`;
    if (!patched.includes(marker)) {
      throw new Error('Could not find Script_Intro field insertion point');
    }
    patched = patched.replace(
      marker,
      `${marker}      ${eol}      public var bIntroWakeStarted:Boolean;${eol}`
    );
  }

  patched = replaceMethod(
    patched,
    'Update',
    normalizeBlock(`
      public function Update(param1:a_GameHook) : void
      {
         if(param1.AtTime(0))
         {
            this.bIntroWakeStarted = false;
            this.am_Puck1.AddBuff("NephitSleep");
            this.am_Puck2.AddBuff("NephitSleep");
            this.am_BigGuy.AddBuff("NephitSleep");
            this.am_Puck1.DeepSleep();
            this.am_Puck2.DeepSleep();
            this.am_BigGuy.DeepSleep();
         }
         if(!this.bIntroWakeStarted && (param1.OnTrigger("am_Trigger_IntroMob") || param1.AtTime(1200)))
         {
            this.bIntroWakeStarted = true;
            param1.PlayScript(this.Script_Intro);
         }
         if(this.bIntroWakeStarted && (param1.OnScriptFinish(this.Script_Intro) || param1.AtTime(3000)))
         {
            this.am_Puck1.RemoveBuff("NephitSleep");
            this.am_Puck2.RemoveBuff("NephitSleep");
            this.am_BigGuy.RemoveBuff("NephitSleep");
            this.am_Puck1.Aggro();
            this.am_Puck2.Aggro();
            this.am_BigGuy.Aggro();
            param1.SetPhase(null);
         }
      }
    `, eol)
  );

  verifyRoomSource(patched, 'patched source');
  return patched;
}

function verifyRoomSource(source, label) {
  const required = [
    'public var bIntroWakeStarted:Boolean;',
    'this.bIntroWakeStarted = false;',
    'this.bIntroWakeStarted = true;',
    'param1.OnTrigger("am_Trigger_IntroMob") || param1.AtTime(1200)',
    'param1.OnScriptFinish(this.Script_Intro) || param1.AtTime(3000)',
    'this.am_Puck1.RemoveBuff("NephitSleep");',
    'this.am_Puck2.RemoveBuff("NephitSleep");',
    'this.am_BigGuy.RemoveBuff("NephitSleep");',
    'this.am_Puck1.Aggro();',
    'this.am_Puck2.Aggro();',
    'this.am_BigGuy.Aggro();'
  ];

  for (const marker of required) {
    if (!source.includes(marker)) {
      throw new Error(`${label} is missing required marker: ${marker}`);
    }
  }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelssd-sdmission4-oasis-intro-wake', path.basename(swfPath, path.extname(swfPath)));
  const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  const original = fs.readFileSync(roomPath, 'utf8');
  const patched = patchRoomSource(original);

  if (patched === original) {
    console.log(`SWF already contains the SD_Mission4 Oasis intro wake patch: ${swfPath}`);
    return;
  }

  fs.writeFileSync(roomPath, patched, 'utf8');
  runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(roomPath)]);
  fs.copyFileSync(patchedSwfPath, swfPath);
  console.log(`Patched SD_Mission4 Oasis intro wake flow in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelssd-sdmission4-oasis-intro-wake-verify', path.basename(swfPath, path.extname(swfPath)));
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  verifyRoomSource(fs.readFileSync(roomPath, 'utf8'), swfPath);
  console.log(`Verified SD_Mission4 Oasis intro wake flow in ${swfPath}`);
}

function main() {
  const repoRoot = resolveRepoRoot();
  const args = parseArgs(process.argv);
  const swfPath = resolvePath(repoRoot, args.swf);
  const ffdecPath = detectFfdec(repoRoot, args.ffdec);

  if (!ffdecPath) {
    throw new Error('FFDec not found. Pass --ffdec or restore the repo-bundled FFDec tool.');
  }

  if (!fs.existsSync(swfPath)) {
    throw new Error(`SWF not found: ${swfPath}`);
  }

  if (args.verify) {
    verifySwf(repoRoot, ffdecPath, swfPath);
    return;
  }

  patchSwf(repoRoot, ffdecPath, swfPath);
  verifySwf(repoRoot, ffdecPath, swfPath);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
