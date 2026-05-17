const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLASS_NAMES = [
  'a_Room_SDMission5_03',
  'a_Room_SDMission5_07',
  'a_Room_SDMission5_09',
  'a_Room_SDMission5_10',
  'a_Room_SDMission5_12'
];
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
    '  node src/server/scripts/patch-levelssd-sdmission5-traps.js [--verify] [--swf <path>] [--ffdec <path>]',
    '',
    'Patches LevelsSD Ancient Unrest trap rooms so the Sandworm and Scarab larva',
    'trap waves activate even when authored triggers or script-finish events are missed.'
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

function exportRoomScripts(ffdecPath, workRoot, swfPath) {
  fs.rmSync(workRoot, { recursive: true, force: true });
  fs.mkdirSync(workRoot, { recursive: true });
  runFfdec(ffdecPath, ['-selectclass', CLASS_NAMES.join(','), '-export', 'script', workRoot, swfPath]);

  const scriptsDir = path.join(workRoot, 'scripts');
  const roomPaths = new Map();
  for (const className of CLASS_NAMES) {
    const roomPath = path.join(scriptsDir, `${className}.as`);
    if (!fs.existsSync(roomPath)) {
      throw new Error(`FFDec export did not produce ${roomPath}`);
    }
    roomPaths.set(className, roomPath);
  }

  return { scriptsDir, roomPaths };
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

function upsertMethodBefore(source, eol, beforeMethodName, methodName, methodBlock) {
  const replacement = normalizeBlock(methodBlock, eol);
  if (source.includes(`public function ${methodName}(`)) {
    return replaceMethod(source, methodName, replacement);
  }

  const marker = `      ${beforeMethodName}`;
  const insertIndex = source.indexOf(marker);
  if (insertIndex === -1) {
    throw new Error(`Could not find method insertion point before ${beforeMethodName}`);
  }

  return `${source.slice(0, insertIndex)}${replacement}${eol}${eol}${source.slice(insertIndex)}`;
}

function normalizeBlock(block, eol) {
  return block.trim().replace(/\n/g, eol);
}

function ensureField(source, eol, markerField, fieldLine) {
  if (source.includes(fieldLine)) {
    return source;
  }

  const marker = `      public var ${markerField};${eol}`;
  if (!source.includes(marker)) {
    throw new Error(`Could not find field insertion point after ${markerField}`);
  }

  return source.replace(marker, `${marker}      ${eol}      ${fieldLine}${eol}`);
}

function patchRoom03(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = ensureField(source, eol, 'Script_CameraShake:Array', 'public var bSandwormTrapStarted:Boolean;');

  patched = replaceMethod(
    patched,
    'Update',
    normalizeBlock(`
      public function Update(param1:a_GameHook) : void
      {
         if(param1.AtTime(0))
         {
            this.bSandwormTrapStarted = false;
         }
         if(!this.bSandwormTrapStarted && (param1.OnTrigger("am_Trigger_Sandworm") || param1.AtTime(900)))
         {
            this.bSandwormTrapStarted = true;
            this.am_Worm.Spawn();
            this.am_Worm.DeepSleep();
            this.am_Worm.Skit("<Emerge>");
            param1.PlayScript(this.Script_IntroWorm);
         }
         if(this.bSandwormTrapStarted && (param1.OnScriptFinish(this.Script_IntroWorm) || param1.AtTime(3500)))
         {
            this.am_Worm.Skit("<Spew>");
            param1.PlayScript(this.Script_CameraShake);
         }
         if(this.bSandwormTrapStarted && (param1.OnScriptFinish(this.Script_CameraShake) || param1.AtTime(5200)))
         {
            this.am_Worm.Aggro();
            param1.SetPhase(null);
         }
      }
    `, eol)
  );

  return patched;
}

function patchRoom07(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = ensureField(source, eol, 'Script_CameraShake:Array', 'public var bChestSandwormTrapStarted:Boolean;');
  patched = ensureField(patched, eol, 'bChestSandwormTrapStarted:Boolean', 'public var bChestExitTrapStarted:Boolean;');
  patched = ensureField(patched, eol, 'bChestExitTrapStarted:Boolean', 'public var aChestExitTrapPucks:Array;');

  patched = replaceMethod(
    patched,
    'InitRoom',
    normalizeBlock(`
      public function InitRoom(param1:a_GameHook) : void
      {
         this.am_Worm1.bHoldSpawn = true;
         this.HoldChestExitTrapPucks();
         param1.initialPhase = this.Update;
      }
    `, eol)
  );

  patched = replaceMethod(
    patched,
    'Update',
    normalizeBlock(`
      public function Update(param1:a_GameHook) : void
      {
         if(param1.AtTime(0))
         {
            this.bChestSandwormTrapStarted = false;
            this.bChestExitTrapStarted = false;
         }
         if(!this.bChestSandwormTrapStarted && this.am_Chest.OnDefeat())
         {
            this.bChestSandwormTrapStarted = true;
            param1.SetVar("SDM5BlueChestBroken","1");
            this.am_Worm1.Spawn();
            this.am_Worm1.DeepSleep();
            this.am_Worm1.Skit("<Emerge>");
            param1.PlayScript(this.Script_IntroWorm);
            param1.SetPhase(this.UpdateChestExitTrap);
         }
      }
    `, eol)
  );

  patched = upsertMethodBefore(
    patched,
    eol,
    'internal function __setProp_am_Chest',
    'UpdateChestExitTrap',
    `
      public function UpdateChestExitTrap(param1:a_GameHook) : void
      {
         if(!this.bChestExitTrapStarted && param1.AtTime(1200))
         {
            this.bChestExitTrapStarted = true;
            this.SpawnChestExitTrapPucks();
         }
         if(this.bChestSandwormTrapStarted && (param1.OnScriptFinish(this.Script_IntroWorm) || param1.AtTime(3600)))
         {
            this.am_Worm1.Skit("<Spew>");
            param1.PlayScript(this.Script_CameraShake);
         }
         if(this.bChestSandwormTrapStarted && (param1.OnScriptFinish(this.Script_CameraShake) || param1.AtTime(5400)))
         {
            this.am_Worm1.Aggro();
            param1.SetPhase(null);
         }
      }
    `
  );

  patched = upsertMethodBefore(
    patched,
    eol,
    'internal function __setProp_am_Chest',
    'HoldChestExitTrapPucks',
    `
      public function HoldChestExitTrapPucks() : void
      {
         var _loc2_:a_Cue = null;
         var _loc3_:DisplayObject = null;
         this.aChestExitTrapPucks = [];
         var _loc1_:int = 0;
         while(_loc1_ < this.numChildren)
         {
            _loc3_ = this.getChildAt(_loc1_);
            if(_loc3_ is ac_PuckShadow || _loc3_ is ac_PuckShadow2)
            {
               _loc2_ = _loc3_ as a_Cue;
               if(_loc2_)
               {
                  _loc2_.bHoldSpawn = true;
                  this.aChestExitTrapPucks.push(_loc2_);
               }
            }
            _loc1_++;
         }
      }
    `
  );

  patched = upsertMethodBefore(
    patched,
    eol,
    'internal function __setProp_am_Chest',
    'SpawnChestExitTrapPucks',
    `
      public function SpawnChestExitTrapPucks() : void
      {
         var _loc2_:a_Cue = null;
         if(!this.aChestExitTrapPucks)
         {
            return;
         }
         var _loc1_:int = 0;
         while(_loc1_ < this.aChestExitTrapPucks.length)
         {
            _loc2_ = this.aChestExitTrapPucks[_loc1_] as a_Cue;
            if(_loc2_)
            {
               _loc2_.Spawn();
            }
            _loc1_++;
         }
      }
    `
  );

  return patched;
}

function patchLarvaTriggerRoom(source, options) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = ensureField(source, eol, options.markerField, options.fieldLine);

  patched = replaceMethod(
    patched,
    'UpdateTrigger',
    normalizeBlock(`
      public function UpdateTrigger(param1:a_GameHook) : void
      {
         if(param1.AtTime(0))
         {
            this.${options.flagName} = false;
         }
         if(!this.${options.flagName} && (param1.OnTrigger("am_Trigger_Larva") || param1.AtTime(900)))
         {
            this.${options.flagName} = true;
            param1.SetPhase(this.UpdateDropLarva);
         }
      }
    `, eol)
  );

  patched = replaceMethod(patched, 'UpdateDropLarva', normalizeBlock(options.dropMethod, eol));
  return patched;
}

function patchRoom09(source) {
  return patchLarvaTriggerRoom(source, {
    markerField: 'am_Foreground:MovieClip',
    fieldLine: 'public var bLarvaTrapStarted:Boolean;',
    flagName: 'bLarvaTrapStarted',
    dropMethod: `
      public function UpdateDropLarva(param1:a_GameHook) : void
      {
         if(param1.AtTime(200))
         {
            this.am_Larva1.Spawn();
         }
         if(param1.AtTime(350))
         {
            this.am_Larva2.Spawn();
            param1.SetPhase(null);
         }
      }
    `
  });
}

function patchRoom10(source) {
  return patchLarvaTriggerRoom(source, {
    markerField: '__id504_:ac_ShadeMage2',
    fieldLine: 'public var bLarvaTrapStarted:Boolean;',
    flagName: 'bLarvaTrapStarted',
    dropMethod: `
      public function UpdateDropLarva(param1:a_GameHook) : void
      {
         if(param1.AtTime(200))
         {
            this.am_Larva1.Spawn();
         }
         if(param1.AtTime(350))
         {
            this.am_Larva2.Spawn();
         }
         if(param1.AtTime(500))
         {
            this.am_Larva3.Spawn();
            param1.SetPhase(null);
         }
      }
    `
  });
}

function patchRoom12(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = ensureField(source, eol, 'Script_CameraShake:Array', 'public var bAmbushTrapStarted:Boolean;');
  patched = ensureField(patched, eol, 'bAmbushTrapStarted:Boolean', 'public var bAmbushCollisionOpened:Boolean;');

  patched = replaceMethod(
    patched,
    'Update',
    normalizeBlock(`
      public function Update(param1:a_GameHook) : void
      {
         if(param1.AtTime(0))
         {
            this.bAmbushTrapStarted = false;
            this.bAmbushCollisionOpened = false;
            param1.CollisionOff("am_DynamicCollision_Ambush");
         }
         if(!this.bAmbushCollisionOpened && (this.am_Chest.OnDefeat() || this.am_Chest.Defeated()))
         {
            this.bAmbushCollisionOpened = true;
            param1.CollisionOn("am_DynamicCollision_Ambush");
            param1.SetPhase(this.UpdateAmbushReady);
         }
      }
    `, eol)
  );

  patched = upsertMethodBefore(
    patched,
    eol,
    'internal function __setProp_am_Chest',
    'UpdateAmbushReady',
    `
      public function UpdateAmbushReady(param1:a_GameHook) : void
      {
         if(!this.bAmbushTrapStarted && (param1.OnTrigger("am_Trigger_Ambush") || param1.AtTime(900)))
         {
            this.bAmbushTrapStarted = true;
            this.am_Worm1.Spawn();
            this.am_Worm1.DeepSleep();
            this.am_Worm1.Skit("<Emerge>");
            this.am_Worm2.Spawn();
            this.am_Worm2.DeepSleep();
            this.am_Worm2.Skit("<Emerge>");
            param1.PlayScript(this.Script_IntroWorm);
         }
         if(this.bAmbushTrapStarted && (param1.OnScriptFinish(this.Script_IntroWorm) || param1.AtTime(4200)))
         {
            this.am_Worm1.Skit("<Spew>");
            this.am_Worm2.Skit("<Spew>");
            param1.PlayScript(this.Script_CameraShake);
         }
         if(this.bAmbushTrapStarted && (param1.OnScriptFinish(this.Script_CameraShake) || param1.AtTime(6000)))
         {
            this.am_Worm1.Aggro();
            this.am_Worm2.Aggro();
            param1.SetPhase(null);
         }
      }
    `
  );

  return patched;
}

const PATCHERS = new Map([
  ['a_Room_SDMission5_03', patchRoom03],
  ['a_Room_SDMission5_07', patchRoom07],
  ['a_Room_SDMission5_09', patchRoom09],
  ['a_Room_SDMission5_10', patchRoom10],
  ['a_Room_SDMission5_12', patchRoom12]
]);

function verifyRoomSource(className, source, label) {
  const requirements = {
    a_Room_SDMission5_03: [
      'public var bSandwormTrapStarted:Boolean;',
      'param1.OnTrigger("am_Trigger_Sandworm") || param1.AtTime(900)',
      'this.am_Worm.Aggro();'
    ],
    a_Room_SDMission5_07: [
      'public var bChestSandwormTrapStarted:Boolean;',
      'public var bChestExitTrapStarted:Boolean;',
      'public var aChestExitTrapPucks:Array;',
      'this.HoldChestExitTrapPucks();',
      'this.am_Chest.OnDefeat()',
      'param1.SetVar("SDM5BlueChestBroken","1");',
      'param1.SetPhase(this.UpdateChestExitTrap);',
      'public function UpdateChestExitTrap',
      'this.SpawnChestExitTrapPucks();',
      'this.am_Worm1.Aggro();'
    ],
    a_Room_SDMission5_09: [
      'public var bLarvaTrapStarted:Boolean;',
      'param1.OnTrigger("am_Trigger_Larva") || param1.AtTime(900)',
      'this.am_Larva1.Spawn();',
      'this.am_Larva2.Spawn();'
    ],
    a_Room_SDMission5_10: [
      'public var bLarvaTrapStarted:Boolean;',
      'param1.OnTrigger("am_Trigger_Larva") || param1.AtTime(900)',
      'this.am_Larva1.Spawn();',
      'this.am_Larva2.Spawn();',
      'this.am_Larva3.Spawn();'
    ],
    a_Room_SDMission5_12: [
      'public var bAmbushTrapStarted:Boolean;',
      'public var bAmbushCollisionOpened:Boolean;',
      'this.am_Chest.OnDefeat() || this.am_Chest.Defeated()',
      'param1.CollisionOff("am_DynamicCollision_Ambush");',
      'param1.CollisionOn("am_DynamicCollision_Ambush");',
      'param1.SetPhase(this.UpdateAmbushReady);',
      'public function UpdateAmbushReady',
      '!this.bAmbushTrapStarted && (param1.OnTrigger("am_Trigger_Ambush") || param1.AtTime(900))',
      'this.am_Worm1.Aggro();',
      'this.am_Worm2.Aggro();'
    ]
  }[className];

  if (!requirements) {
    throw new Error(`No verifier requirements for ${className}`);
  }

  for (const marker of requirements) {
    if (!source.includes(marker)) {
      throw new Error(`${label} ${className} is missing required marker: ${marker}`);
    }
  }

  if (className === 'a_Room_SDMission5_10' && !source.includes('if(param1.AtTime(350))\r\n         {\r\n            this.am_Larva2.Spawn();') && !source.includes('if(param1.AtTime(350))\n         {\n            this.am_Larva2.Spawn();')) {
    throw new Error(`${label} ${className} still does not spawn am_Larva2 at the middle drop point`);
  }

  if (className === 'a_Room_SDMission5_07' && source.includes('this.am_Chest.OnDefeat() || param1.AtTime(1200)')) {
    throw new Error(`${label} ${className} still arms the chest room trap from the room-entry timer`);
  }

  if (className === 'a_Room_SDMission5_12' && (source.includes('this.am_Chest.OnDefeat() || param1.AtTime(1200)') || source.includes('param1.OnTrigger("am_Trigger_Ambush") || param1.AtTime(1800)') || source.includes('param1.GetVar("SDM5BlueChestBroken") == "1"') || source.includes('this.bAmbushCollisionOpened = true;\r\n            param1.CollisionOn("am_DynamicCollision_Ambush");\r\n         }\r\n         if(this.bAmbushCollisionOpened && !this.bAmbushTrapStarted') || source.includes('this.bAmbushCollisionOpened = true;\n            param1.CollisionOn("am_DynamicCollision_Ambush");\n         }\n         if(this.bAmbushCollisionOpened && !this.bAmbushTrapStarted'))) {
    throw new Error(`${label} ${className} still activates the ambush sandworms from local chest or room-entry timers`);
  }
}

function patchSources(roomPaths) {
  let changed = false;

  for (const className of CLASS_NAMES) {
    const roomPath = roomPaths.get(className);
    const source = fs.readFileSync(roomPath, 'utf8');
    try {
      verifyRoomSource(className, source, 'current source');
      continue;
    } catch (_error) {
      // Continue into the source patch path below.
    }

    const patcher = PATCHERS.get(className);
    const patched = patcher(source);
    verifyRoomSource(className, patched, 'patched source');
    if (patched !== source) {
      fs.writeFileSync(roomPath, patched, 'utf8');
      changed = true;
    }
  }

  return changed;
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelssd-sdmission5-traps', path.basename(swfPath, path.extname(swfPath)));
  const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
  const { scriptsDir, roomPaths } = exportRoomScripts(ffdecPath, workRoot, swfPath);

  if (!patchSources(roomPaths)) {
    console.log(`SWF already contains the SD_Mission5 trap activation patch: ${swfPath}`);
    return;
  }

  runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, scriptsDir]);
  fs.copyFileSync(patchedSwfPath, swfPath);
  console.log(`Patched SD_Mission5 trap activation flow in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelssd-sdmission5-traps-verify', path.basename(swfPath, path.extname(swfPath)));
  const { roomPaths } = exportRoomScripts(ffdecPath, workRoot, swfPath);

  for (const className of CLASS_NAMES) {
    verifyRoomSource(className, fs.readFileSync(roomPaths.get(className), 'utf8'), swfPath);
  }

  console.log(`Verified SD_Mission5 trap activation flow in ${swfPath}`);
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
  } else {
    patchSwf(repoRoot, ffdecPath, swfPath);
    verifySwf(repoRoot, ffdecPath, swfPath);
  }
}

if (require.main === module) {
  main();
}
