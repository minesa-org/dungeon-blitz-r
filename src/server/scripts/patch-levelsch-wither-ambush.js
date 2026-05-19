const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const BOSS_CLASS_NAME = 'a_Room_CHM01RYagagaBoss';
const TRAP_CLASS_NAME = 'a_Room_CHmini45';

function parseArgs(argv) {
  const args = {
    swf: path.join('src', 'client', 'content', 'localhost', 'p', 'cam', 'LevelsCH.swf'),
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
    '  node src/server/scripts/patch-levelsch-wither-ambush.js [--verify] [--swf <path>] [--ffdec <path>]',
    '',
    'Patches LevelsCH so Wither the Witch ambushes behave correctly:',
    '- boss health-threshold waves still spawn if a threshold is skipped',
    '- the a_Room_CHmini45 visible alpha and hidden jackal pack aggro at the entry line'
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
    path.join(repoRoot, 'build', 'ffdec', 'ffdec-cli.jar'),
    path.join(repoRoot, 'build', 'ffdec', 'ffdec.jar'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_26.0.0', 'ffdec-cli.jar'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_26.0.0', 'ffdec.jar'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_25.0.0', 'ffdec-cli.jar'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_25.0.0', 'ffdec.jar')
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
    execFileSync('java', ['-jar', resolved, '-cli', ...args], {
      stdio: 'inherit'
    });
    return;
  }

  execFileSync(resolved, ['-cli', ...args], {
    stdio: 'inherit'
  });
}

function exportRoomScript(ffdecPath, workRoot, swfPath, className) {
  runFfdec(ffdecPath, ['-selectclass', className, '-export', 'script', workRoot, swfPath]);

  const roomPath = path.join(workRoot, 'scripts', `${className}.as`);
  if (!fs.existsSync(roomPath)) {
    throw new Error(`FFDec export did not produce ${roomPath}`);
  }

  return roomPath;
}

function exportRoomScripts(ffdecPath, workRoot, swfPath) {
  fs.rmSync(workRoot, { recursive: true, force: true });
  fs.mkdirSync(workRoot, { recursive: true });

  return {
    boss: exportRoomScript(ffdecPath, workRoot, swfPath, BOSS_CLASS_NAME),
    trap: exportRoomScript(ffdecPath, workRoot, swfPath, TRAP_CLASS_NAME)
  };
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

function replaceExact(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Could not find patch marker: ${label}`);
  }
  return source.replace(needle, replacement);
}

function normalizeBlock(block, eol) {
  return block.trim().replace(/\n/g, eol);
}

function removeOptionalBossEntryAmbushPatch(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = source;

  const entryField = `      public var bEntryAmbushTriggered:Boolean;${eol}      ${eol}`;
  if (patched.includes(entryField)) {
    patched = patched.replace(entryField, '');
  }

  const initialPhaseLine = `         param1.initialPhase = this.PhaseEntryAmbush;${eol}`;
  if (patched.includes(initialPhaseLine)) {
    patched = patched.replace(initialPhaseLine, '');
  }

  if (patched.includes('public function PhaseEntryAmbush(param1:a_GameHook) : void')) {
    const range = findMethodRange(patched, 'PhaseEntryAmbush');
    patched = `${patched.slice(0, range.start)}${patched.slice(range.end)}`;
    patched = patched.replace(`${eol}      ${eol}      ${eol}      public function PhaseFight`, `${eol}      ${eol}      public function PhaseFight`);
  }

  return patched;
}

function patchBossRoomSource(source) {
  source = removeOptionalBossEntryAmbushPatch(source);

  try {
    verifyBossRoomSource(source, 'current source');
    return source;
  } catch (_error) {
    // Continue into the source patch path below.
  }

  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = source;

  if (!patched.includes('public var bWaveOneTriggered:Boolean;')) {
    patched = replaceExact(
      patched,
      `      public var am_Foreground:MovieClip;${eol}`,
      [
        '      public var am_Foreground:MovieClip;',
        '      ',
        '      public var bWaveOneTriggered:Boolean;',
        '      ',
        '      public var bWaveTwoTriggered:Boolean;',
        '      ',
        '      public var bWaveThreeTriggered:Boolean;',
        ''
      ].join(eol),
      'wave trigger state fields'
    );
  }

  patched = replaceMethod(
    patched,
    'PhaseFight',
    normalizeBlock(`
      public function PhaseFight(param1:a_GameHook) : void
      {
         var _loc2_:Number = this.am_Boss.Health();
         if(!this.bWaveOneTriggered && (this.am_Boss.AtHealth(0.9) || _loc2_ <= 0.9))
         {
            this.bWaveOneTriggered = true;
            param1.Ambush("am_WaveOne");
         }
         if(!this.bWaveTwoTriggered && (this.am_Boss.AtHealth(0.66) || _loc2_ <= 0.66))
         {
            if(!this.bWaveOneTriggered)
            {
               this.bWaveOneTriggered = true;
               param1.Ambush("am_WaveOne");
            }
            this.bWaveTwoTriggered = true;
            param1.Ambush("am_WaveTwo");
            this.am_WaveOne.am_Leader.Skit("Hee hee");
         }
         if(!this.bWaveThreeTriggered && (this.am_Boss.AtHealth(0.33) || _loc2_ <= 0.33))
         {
            if(!this.bWaveOneTriggered)
            {
               this.bWaveOneTriggered = true;
               param1.Ambush("am_WaveOne");
            }
            if(!this.bWaveTwoTriggered)
            {
               this.bWaveTwoTriggered = true;
               param1.Ambush("am_WaveTwo");
            }
            this.bWaveThreeTriggered = true;
            param1.Ambush("am_WaveThree");
            this.am_WaveThree.am_Leader.Skit("Get him|her");
         }
      }
    `, eol)
  );

  verifyBossRoomSource(patched, 'patched source');
  return patched;
}

function verifyBossRoomSource(source, label) {
  const required = [
    'public var bWaveOneTriggered:Boolean;',
    'public var bWaveTwoTriggered:Boolean;',
    'public var bWaveThreeTriggered:Boolean;',
    'var _loc2_:Number = this.am_Boss.Health();',
    '!this.bWaveOneTriggered && (this.am_Boss.AtHealth(0.9) || _loc2_ <= 0.9)',
    '!this.bWaveTwoTriggered && (this.am_Boss.AtHealth(0.66) || _loc2_ <= 0.66)',
    '!this.bWaveThreeTriggered && (this.am_Boss.AtHealth(0.33) || _loc2_ <= 0.33)',
    'param1.Ambush("am_WaveOne");',
    'param1.Ambush("am_WaveTwo");',
    'param1.Ambush("am_WaveThree");'
  ];

  for (const marker of required) {
    if (!source.includes(marker)) {
      throw new Error(`${label} is missing required marker: ${marker}`);
    }
  }

  const forbidden = [
    'public var bEntryAmbushTriggered:Boolean;',
    'param1.initialPhase = this.PhaseEntryAmbush;',
    'public function PhaseEntryAmbush(param1:a_GameHook) : void'
  ];

  for (const marker of forbidden) {
    if (source.includes(marker)) {
      throw new Error(`${label} still contains obsolete boss entry ambush marker: ${marker}`);
    }
  }
}

function insertAfterMethod(source, methodName, insertion) {
  const range = findMethodRange(source, methodName);
  return `${source.slice(0, range.end)}${insertion}${source.slice(range.end)}`;
}

function patchTrapRoomSource(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = source;

  const obsoleteTrapField = `      public var bTrapAmbushTriggered:Boolean;${eol}      ${eol}`;
  if (patched.includes(obsoleteTrapField)) {
    patched = patched.replace(obsoleteTrapField, '');
  }

  const obsoleteHiddenPackField = `      public var bHiddenPackTriggered:Boolean;${eol}      ${eol}`;
  if (patched.includes(obsoleteHiddenPackField)) {
    patched = patched.replace(obsoleteHiddenPackField, '');
  }

  if (!patched.includes('public var bEntryLineAmbushTriggered:Boolean;')) {
    patched = replaceExact(
      patched,
      `      public var am_Foreground:MovieClip;${eol}`,
      [
        '      public var am_Foreground:MovieClip;',
        '      ',
        '      public var bEntryLineAmbushTriggered:Boolean;',
        ''
      ].join(eol),
      'entry line ambush trigger state field'
    );
  }

  if (patched.includes('public function PhaseHiddenPackTrap(param1:a_GameHook) : void')) {
    const range = findMethodRange(patched, 'PhaseHiddenPackTrap');
    patched = `${patched.slice(0, range.start)}${patched.slice(range.end)}`;
  }

  if (patched.includes('public function PhaseTrapAmbush(param1:a_GameHook) : void')) {
    const range = findMethodRange(patched, 'PhaseTrapAmbush');
    patched = `${patched.slice(0, range.start)}${patched.slice(range.end)}`;
  }

  if (patched.includes('public function PhaseHiddenPackOnAlphaAlert(param1:a_GameHook) : void')) {
    const range = findMethodRange(patched, 'PhaseHiddenPackOnAlphaAlert');
    patched = `${patched.slice(0, range.start)}${patched.slice(range.end)}`;
  }

  if (patched.includes('public function PhaseLinkHiddenPackAggroTeam(param1:a_GameHook) : void')) {
    const range = findMethodRange(patched, 'PhaseLinkHiddenPackAggroTeam');
    patched = `${patched.slice(0, range.start)}${patched.slice(range.end)}`;
  }

  const initRoomMethod = normalizeBlock(`
      public function InitRoom(param1:a_GameHook) : void
      {
         param1.initialPhase = this.PhaseEntryLineAmbush;
      }
  `, eol);

  if (patched.includes('public function InitRoom(param1:a_GameHook) : void')) {
    patched = replaceMethod(patched, 'InitRoom', initRoomMethod);
  } else {
    patched = insertAfterMethod(patched, TRAP_CLASS_NAME, `${eol}      ${eol}${initRoomMethod}`);
  }

  const entryLineAmbushPhaseMethod = normalizeBlock(`
      public function PhaseEntryLineAmbush(param1:a_GameHook) : void
      {
         var _loc2_:Object = param1.linkToRoom.var_1.clientEnt;
         if(!this.bEntryLineAmbushTriggered && _loc2_ && _loc2_.currRoom == param1.linkToRoom && _loc2_.physPosX >= 856)
         {
            this.bEntryLineAmbushTriggered = true;
            this.AggroEntryLineEntity(param1,"__id624_",_loc2_);
            this.AggroEntryLineEntity(param1,"__id618_",_loc2_);
            this.AggroEntryLineEntity(param1,"__id620_",_loc2_);
            this.AggroEntryLineEntity(param1,"__id621_",_loc2_);
            this.AggroEntryLineEntity(param1,"__id622_",_loc2_);
            param1.SetPhase(null);
         }
      }
  `, eol);

  if (patched.includes('public function PhaseEntryLineAmbush(param1:a_GameHook) : void')) {
    patched = replaceMethod(patched, 'PhaseEntryLineAmbush', entryLineAmbushPhaseMethod);
  } else {
    patched = insertAfterMethod(patched, 'InitRoom', `${eol}      ${eol}${entryLineAmbushPhaseMethod}`);
  }

  const aggroEntryLineEntityMethod = normalizeBlock(`
      public function AggroEntryLineEntity(param1:a_GameHook, param2:String, param3:Object) : void
      {
         var _loc4_:Object = param1.linkToRoom.method_35(param2);
         if(_loc4_ && _loc4_.brain)
         {
            _loc4_.brain.bDeepSleep = false;
            _loc4_.brain.AddHate(param3,0,false);
         }
      }
  `, eol);

  if (patched.includes('public function AggroEntryLineEntity(param1:a_GameHook, param2:String, param3:Object) : void')) {
    patched = replaceMethod(patched, 'AggroEntryLineEntity', aggroEntryLineEntityMethod);
  } else {
    patched = insertAfterMethod(patched, 'PhaseEntryLineAmbush', `${eol}      ${eol}${aggroEntryLineEntityMethod}`);
  }

  verifyTrapRoomSource(patched, 'patched source');
  return patched;
}

function verifyTrapRoomSource(source, label) {
  const required = [
    'public var __id618_:ac_JackalPackmate2;',
    'public var __id622_:ac_JackalPackmate;',
    'public var __id620_:ac_DogRogue;',
    'public var __id621_:ac_JackalPackmate2;',
    'public var __id624_:ac_JackalAlpha;',
    'public var bEntryLineAmbushTriggered:Boolean;',
    'param1.initialPhase = this.PhaseEntryLineAmbush;',
    'public function PhaseEntryLineAmbush(param1:a_GameHook) : void',
    'var _loc2_:Object = param1.linkToRoom.var_1.clientEnt;',
    '!this.bEntryLineAmbushTriggered && _loc2_ && _loc2_.currRoom == param1.linkToRoom && _loc2_.physPosX >= 856',
    'this.bEntryLineAmbushTriggered = true;',
    'this.AggroEntryLineEntity(param1,"__id624_",_loc2_);',
    'this.AggroEntryLineEntity(param1,"__id618_",_loc2_);',
    'this.AggroEntryLineEntity(param1,"__id620_",_loc2_);',
    'this.AggroEntryLineEntity(param1,"__id621_",_loc2_);',
    'this.AggroEntryLineEntity(param1,"__id622_",_loc2_);',
    'param1.SetPhase(null);',
    'public function AggroEntryLineEntity(param1:a_GameHook, param2:String, param3:Object) : void',
    'var _loc4_:Object = param1.linkToRoom.method_35(param2);',
    '_loc4_.brain.bDeepSleep = false;',
    '_loc4_.brain.AddHate(param3,0,false);'
  ];

  for (const marker of required) {
    if (!source.includes(marker)) {
      throw new Error(`${label} is missing expected room marker: ${marker}`);
    }
  }

  const forbidden = [
    'public var bTrapAmbushTriggered:Boolean;',
    'public var bHiddenPackTriggered:Boolean;',
    'public function PhaseTrapAmbush(param1:a_GameHook) : void',
    'public function PhaseHiddenPackTrap(param1:a_GameHook) : void',
    'public function PhaseHiddenPackOnAlphaAlert(param1:a_GameHook) : void',
    'public function PhaseLinkHiddenPackAggroTeam(param1:a_GameHook) : void',
    'PhaseHiddenPackOnAlphaAlert',
    'PhaseLinkHiddenPackAggroTeam',
    'brain.target',
    'param1.linkToRoom.GetTarget();',
    'physPosX >= 12200',
    'physPosX >= 19400',
    'this.__id624_.Aggro();',
    'this.__id618_.Aggro();',
    'this.__id620_.Aggro();',
    'this.__id621_.Aggro();',
    'this.__id622_.Aggro();',
    'aggroTeamID = this.__id624_.aggroTeamID'
  ];

  for (const marker of forbidden) {
    if (source.includes(marker)) {
      throw new Error(`${label} still contains obsolete a_Room_CHmini45 trap marker: ${marker}`);
    }
  }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelsch-wither-ambush', path.basename(swfPath, path.extname(swfPath)));
  const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
  const roomPaths = exportRoomScripts(ffdecPath, workRoot, swfPath);
  const bossOriginal = fs.readFileSync(roomPaths.boss, 'utf8');
  const trapOriginal = fs.readFileSync(roomPaths.trap, 'utf8');
  const bossPatched = patchBossRoomSource(bossOriginal);
  const trapPatched = patchTrapRoomSource(trapOriginal);

  if (bossPatched === bossOriginal && trapPatched === trapOriginal) {
    console.log(`SWF already contains the Wither ambush patches: ${swfPath}`);
    return;
  }

  fs.writeFileSync(roomPaths.boss, bossPatched, 'utf8');
  fs.writeFileSync(roomPaths.trap, trapPatched, 'utf8');
  runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(roomPaths.boss)]);
  fs.copyFileSync(patchedSwfPath, swfPath);
  console.log(`Patched Wither ambush behavior in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelsch-wither-ambush-verify', path.basename(swfPath, path.extname(swfPath)));
  const roomPaths = exportRoomScripts(ffdecPath, workRoot, swfPath);
  verifyBossRoomSource(fs.readFileSync(roomPaths.boss, 'utf8'), swfPath);
  verifyTrapRoomSource(fs.readFileSync(roomPaths.trap, 'utf8'), swfPath);
  console.log(`Verified Wither ambush behavior in ${swfPath}`);
}

function main() {
  const repoRoot = resolveRepoRoot();
  const args = parseArgs(process.argv);
  const swfPath = resolvePath(repoRoot, args.swf);
  const ffdecPath = detectFfdec(repoRoot, args.ffdec);

  if (!ffdecPath) {
    throw new Error('FFDec not found. Pass --ffdec or restore the repo-bundled FFDec tool.');
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
