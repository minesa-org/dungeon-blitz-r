const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLASS_NAME = 'a_Room_SDMission3_08';
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
    '  node src/server/scripts/patch-levelssd-blood-and-sand-boss-cutscene.js [--verify] [--swf <path>] [--ffdec <path>]',
    '',
    'Patches LevelsSD a_Room_SDMission3_08 so the BloodAndSand boss fight',
    'waits for the intro cutscene to finish before enabling boss behavior.'
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

function ensureFfdecHome(repoRoot) {
  const ffdecHome = path.join(repoRoot, 'build', 'ffdec-home');
  fs.mkdirSync(path.join(ffdecHome, 'JPEXS', 'FFDec', 'logs'), { recursive: true });
  fs.mkdirSync(path.join(ffdecHome, 'LocalAppData'), { recursive: true });
  fs.mkdirSync(path.join(ffdecHome, 'Library', 'Application Support', 'FFDec', 'logs'), { recursive: true });
  return ffdecHome;
}

function runFfdec(ffdecPath, args) {
  const resolved = path.resolve(ffdecPath);
  const basename = path.basename(resolved).toLowerCase();
  const repoRoot = resolveRepoRoot();
  const ffdecHome = ensureFfdecHome(repoRoot);
  const env = {
    ...process.env,
    APPDATA: ffdecHome,
    HOME: ffdecHome,
    LOCALAPPDATA: path.join(ffdecHome, 'LocalAppData'),
    USERPROFILE: ffdecHome
  };

  if (basename.endsWith('.jar')) {
    execFileSync('java', [`-Duser.home=${ffdecHome}`, '-jar', resolved, '-cli', ...args], { env, stdio: 'inherit' });
    return;
  }

  execFileSync(resolved, ['-cli', ...args], { env, stdio: 'inherit' });
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

  if (!patched.includes('public var bBossIntroFinished:Boolean;')) {
    const marker = `      public var bAlVaerazAlive:Boolean;${eol}`;
    if (!patched.includes(marker)) {
      throw new Error('Could not find bAlVaerazAlive field insertion point');
    }
    patched = patched.replace(
      marker,
      `${marker}      ${eol}      public var bBossIntroFinished:Boolean;${eol}`
    );
  }

  if (!patched.includes('this.am_Boss.bHoldEngage = true;') || !patched.includes('this.am_AlVaeraz.bHoldEngage = true;')) {
    const marker = `         this.am_AlVaeraz.bHoldSpawn = true;${eol}`;
    if (!patched.includes(marker)) {
      throw new Error('Could not find BloodAndSand boss hold insertion point');
    }
    const holdLines = [
      !patched.includes('this.am_Boss.bHoldEngage = true;') ? '         this.am_Boss.bHoldEngage = true;' : '',
      !patched.includes('this.am_AlVaeraz.bHoldEngage = true;') ? '         this.am_AlVaeraz.bHoldEngage = true;' : ''
    ].filter(Boolean).join(eol);
    patched = patched.replace(marker, `${marker}${holdLines}${eol}`);
  }

  patched = replaceMethod(
    patched,
    'UpdateNextWave',
    normalizeBlock(`
      public function UpdateNextWave(param1:a_GameHook) : void
      {
         if(param1.AtTime(1000))
         {
            if(this.currWave <= this.NUMBER_OF_WAVES)
            {
               param1.Group(this.am_Minions,this.SPAWN_MINION_AMOUNT).Spawn();
               param1.Group(this.am_Lieutenants,this.SPAWN_LIEUTENANT_AMOUNT).Spawn();
               ++this.currWave;
               param1.SetPhase(this.UpdateArena);
            }
            else
            {
               this.bBossIntroFinished = false;
               this.HoldBossIntroActors();
               this.am_Boss.Spawn();
               this.am_AlVaeraz.Spawn();
               this.HoldBossIntroActors();
               this.am_LastMonster.Kill();
               param1.bossFightPhase = this.UpdateBossIntroGate;
            }
         }
      }
    `, eol)
  );

  const holdMethod = normalizeBlock(`
      public function HoldBossIntroActors() : void
      {
         this.am_Boss.bHoldEngage = true;
         this.am_AlVaeraz.bHoldEngage = true;
         this.am_Boss.DeepSleep();
         this.am_AlVaeraz.DeepSleep();
         this.am_Boss.ClearHate();
         this.am_AlVaeraz.ClearHate();
      }
  `, eol);

  const releaseMethod = normalizeBlock(`
      public function ReleaseBossIntroActors() : void
      {
         this.bBossIntroFinished = true;
         this.am_Boss.bHoldEngage = false;
         this.am_AlVaeraz.bHoldEngage = false;
         this.am_Boss.ClearHate();
         this.am_AlVaeraz.ClearHate();
         this.bAlVaerazAlive = true;
         this.am_Boss.AddBuff("GladiatorNerf");
         this.am_Boss.Aggro();
         this.am_AlVaeraz.Aggro();
      }
  `, eol);

  const gateMethod = normalizeBlock(`
      public function UpdateBossIntroGate(param1:a_GameHook) : void
      {
         if(!this.bBossIntroFinished && !param1.OnScriptFinish(param1.cutSceneStartBoss) && !param1.AtTime(26000))
         {
            this.HoldBossIntroActors();
            return;
         }
         this.ReleaseBossIntroActors();
         param1.bossFightPhase = this.UpdateBoss;
         param1.SetPhase(null);
      }
  `, eol);

  const marker = `      public function UpdateBoss(param1:a_GameHook) : void${eol}`;
  if (!patched.includes(marker)) {
    throw new Error('Could not find UpdateBoss insertion point');
  }

  if (patched.includes('public function HoldBossIntroActors(')) {
    patched = replaceMethod(patched, 'HoldBossIntroActors', holdMethod);
  } else {
    patched = patched.replace(marker, `${holdMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function ReleaseBossIntroActors(')) {
    patched = replaceMethod(patched, 'ReleaseBossIntroActors', releaseMethod);
  } else {
    patched = patched.replace(marker, `${releaseMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function UpdateBossIntroGate(')) {
    patched = replaceMethod(patched, 'UpdateBossIntroGate', gateMethod);
  } else {
    patched = patched.replace(marker, `${gateMethod}${eol}      ${eol}${marker}`);
  }

  verifyRoomSource(patched, 'patched source');
  return patched;
}

function verifyRoomSource(source, label) {
  const required = [
    'public var bBossIntroFinished:Boolean;',
    'this.am_Boss.bHoldEngage = true;',
    'this.am_AlVaeraz.bHoldEngage = true;',
    'this.bBossIntroFinished = false;',
    'this.HoldBossIntroActors();',
    'param1.bossFightPhase = this.UpdateBossIntroGate;',
    'public function HoldBossIntroActors() : void',
    'this.am_Boss.DeepSleep();',
    'this.am_AlVaeraz.DeepSleep();',
    'this.am_Boss.ClearHate();',
    'this.am_AlVaeraz.ClearHate();',
    'public function ReleaseBossIntroActors() : void',
    'public function UpdateBossIntroGate(param1:a_GameHook) : void',
    'param1.OnScriptFinish(param1.cutSceneStartBoss)',
    'param1.AtTime(26000)',
    'this.HoldBossIntroActors();',
    'this.ReleaseBossIntroActors();',
    'this.bBossIntroFinished = true;',
    'this.am_Boss.bHoldEngage = false;',
    'this.am_AlVaeraz.bHoldEngage = false;',
    'this.am_Boss.Aggro();',
    'this.am_AlVaeraz.Aggro();',
    'this.am_Boss.AddBuff("GladiatorNerf");',
    'param1.bossFightPhase = this.UpdateBoss;',
    'param1.SetPhase(null);'
  ];

  for (const marker of required) {
    if (!source.includes(marker)) {
      throw new Error(`${label} is missing required marker: ${marker}`);
    }
  }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelssd-blood-and-sand-boss-cutscene', path.basename(swfPath, path.extname(swfPath)));
  const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  const original = fs.readFileSync(roomPath, 'utf8');
  const patched = patchRoomSource(original);

  if (patched === original) {
    console.log(`SWF already contains the BloodAndSand boss cutscene gate patch: ${swfPath}`);
    return;
  }

  fs.writeFileSync(roomPath, patched, 'utf8');
  runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(roomPath)]);
  fs.copyFileSync(patchedSwfPath, swfPath);
  console.log(`Patched BloodAndSand boss cutscene gate in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelssd-blood-and-sand-boss-cutscene-verify', path.basename(swfPath, path.extname(swfPath)));
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  verifyRoomSource(fs.readFileSync(roomPath, 'utf8'), swfPath);
  console.log(`Verified BloodAndSand boss cutscene gate in ${swfPath}`);
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
