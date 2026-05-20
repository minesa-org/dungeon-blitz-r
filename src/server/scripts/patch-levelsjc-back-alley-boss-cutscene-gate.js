const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLASS_NAME = 'a_Room_JCMission2_08';
const DEFAULT_SWF = path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'LevelsJC.swf');

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
    '  node src/server/scripts/patch-levelsjc-back-alley-boss-cutscene-gate.js [--verify] [--swf <path>] [--ffdec <path>]',
    '',
    'Patches LevelsJC a_Room_JCMission2_08 so the Back Alley Deals boss fight',
    'waits for the boss intro cutscene to finish before enabling boss behavior.'
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

function removeMethod(source, methodName) {
  if (!source.includes(`public function ${methodName}(`)) {
    return source;
  }
  const range = findMethodRange(source, methodName);
  return `${source.slice(0, range.start)}${source.slice(range.end)}`;
}

function normalizeBlock(block, eol) {
  return block.trim().replace(/\n/g, eol);
}

function patchRoomSource(source) {
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = source;

  if (!patched.includes('public var bBossIntroFinished:Boolean;')) {
    const marker = `      public var bMageLeaving:Boolean;${eol}`;
    if (!patched.includes(marker)) {
      throw new Error('Could not find Back Alley boss intro field insertion point');
    }
    patched = patched.replace(marker, `${marker}      ${eol}      public var bBossIntroFinished:Boolean;${eol}      ${eol}      public var bBossIntroActorsSpawned:Boolean;${eol}`);
  } else if (!patched.includes('public var bBossIntroActorsSpawned:Boolean;')) {
    const marker = `      public var bBossIntroFinished:Boolean;${eol}`;
    if (!patched.includes(marker)) {
      throw new Error('Could not find Back Alley boss actor-spawn field insertion point');
    }
    patched = patched.replace(marker, `${marker}      ${eol}      public var bBossIntroActorsSpawned:Boolean;${eol}`);
  }

  if (!patched.includes('this.am_Boss.bHoldEngage = true;') || !patched.includes('this.am_Boss2.bHoldEngage = true;')) {
    const marker = `         this.am_Boss2.bHoldSpawn = true;${eol}`;
    if (!patched.includes(marker)) {
      throw new Error('Could not find Back Alley boss hold insertion point');
    }
    const holdLines = [
      !patched.includes('this.am_Boss.bHoldEngage = true;') ? '         this.am_Boss.bHoldEngage = true;' : '',
      !patched.includes('this.am_Boss2.bHoldEngage = true;') ? '         this.am_Boss2.bHoldEngage = true;' : ''
    ].filter(Boolean).join(eol);
    patched = patched.replace(marker, `${marker}${holdLines}${eol}`);
  }

  const cutsceneWithSpawnCue = `         param1.cutSceneStartBoss = ["0 Camera 1","8 Mage <CastStormMale> Your audacity is disgusting, #tn#!","12 Mage First you steal our homeland now you come here!","12 Player Your homeland? What are you talking about?","12 Mage You think you can be Baron of Ellyria?","12 Mage <SkyPower> Not while my family draws breath!","6 Camera 3","3 QuickFirePower EffectMarker2 OasisTeleportEffectLarge","0 Shake 10","1 SpawnCue Boss2","1 Boss2 <Melee>","6 Camera 2","4 QuickFirePower EffectMarker1 OasisTeleportEffectLarge","0 Shake 10","1 SpawnCue Boss","1 Boss <Melee>","4 Camera 1","4 End"];`;
  const cutsceneWithoutSpawnCue = `         param1.cutSceneStartBoss = ["0 Camera 1","8 Mage <CastStormMale> Your audacity is disgusting, #tn#!","12 Mage First you steal our homeland now you come here!","12 Player Your homeland? What are you talking about?","12 Mage You think you can be Baron of Ellyria?","12 Mage <SkyPower> Not while my family draws breath!","6 Camera 3","3 QuickFirePower EffectMarker2 OasisTeleportEffectLarge","0 Shake 10","1 Boss2 <Melee>","6 Camera 2","4 QuickFirePower EffectMarker1 OasisTeleportEffectLarge","0 Shake 10","1 Boss <Melee>","4 Camera 1","4 End"];`;
  if (patched.includes(cutsceneWithSpawnCue)) {
    patched = patched.replace(cutsceneWithSpawnCue, cutsceneWithoutSpawnCue);
  }

  patched = patched.replace(
    /         param1\.bossFightBeginsWhenThisGuyIsDead = (?:null|"am_LastGuy");/,
    `         param1.bossFightBeginsWhenThisGuyIsDead = null;`
  );
  if (!patched.includes('         param1.bDoubleBossFight = true;')) {
    patched = patched.replace(
      `         param1.bossFightBeginsWhenThisGuyIsDead = null;`,
      `         param1.bossFightBeginsWhenThisGuyIsDead = null;${eol}         param1.bDoubleBossFight = true;`
    );
  }

  patched = replaceMethod(
    patched,
    'UpdateInitialWait',
    normalizeBlock(`
      public function UpdateInitialWait(param1:a_GameHook) : void
      {
         if(param1.AtTime(0))
         {
            this.am_LastGuy.AddBuff("DefectorMove");
            this.am_LastGuy.DeepSleep();
            this.am_Mage.AddBuff("DefectorMove");
            this.am_Mage.DeepSleep();
         }
         if(param1.OnTrigger("am_Trigger_Boss"))
         {
            this.bBossIntroFinished = false;
            this.bBossIntroActorsSpawned = false;
            this.HoldBossIntroActors();
            param1.bDoubleBossFight = true;
            param1.bossFightBeginsWhenThisGuyIsDead = null;
            param1.bossFightPhase = null;
            this.am_LastGuy.Remove();
            param1.PlayCutScene(param1.cutSceneStartBoss);
            param1.SetPhase(this.UpdateBossIntroGate);
         }
      }
    `, eol)
  );

  const holdMethod = normalizeBlock(`
      public function HoldBossIntroActors() : void
      {
         this.am_Boss.bHoldEngage = true;
         this.am_Boss2.bHoldEngage = true;
         this.am_Boss.DeepSleep();
         this.am_Boss2.DeepSleep();
         this.am_Boss.ClearHate();
         this.am_Boss2.ClearHate();
      }
  `, eol);

  const spawnSecondMethod = normalizeBlock(`
      public function SpawnBoss2IntroHeld() : void
      {
         this.am_Boss2.bHoldSpawn = false;
         this.am_Boss2.bHoldEngage = true;
         if(!this.am_Boss2.bSpawned)
         {
            this.am_Boss2.Spawn();
         }
         this.HoldBossIntroActors();
      }
  `, eol);

  const spawnFirstMethod = normalizeBlock(`
      public function SpawnBoss1IntroHeld() : void
      {
         this.am_Boss.bHoldSpawn = false;
         this.am_Boss.bHoldEngage = true;
         if(!this.am_Boss.bSpawned)
         {
            this.am_Boss.Spawn();
         }
         this.HoldBossIntroActors();
      }
  `, eol);

  const spawnHeldMethod = normalizeBlock(`
      public function SpawnBossIntroActorsHeld() : void
      {
         this.am_Boss.bHoldSpawn = false;
         this.am_Boss2.bHoldSpawn = false;
         this.am_Boss.bHoldEngage = true;
         this.am_Boss2.bHoldEngage = true;
         if(!this.am_Boss.bSpawned)
         {
            this.am_Boss.Spawn();
         }
         if(!this.am_Boss2.bSpawned)
         {
            this.am_Boss2.Spawn();
         }
         this.bBossIntroActorsSpawned = true;
         this.HoldBossIntroActors();
      }
  `, eol);

  const releaseMethod = normalizeBlock(`
      public function ReleaseBossIntroActors(param1:a_GameHook = null) : void
      {
         if(!this.bBossIntroFinished)
         {
            this.am_LastGuy.Remove();
         }
         this.bBossIntroFinished = true;
         this.am_Boss.bHoldSpawn = false;
         this.am_Boss2.bHoldSpawn = false;
         this.am_Boss.bHoldEngage = false;
         this.am_Boss2.bHoldEngage = false;
         this.am_Boss.Sleep();
         this.am_Boss2.Sleep();
         this.am_Boss.ClearHate();
         this.am_Boss2.ClearHate();
         this.EnsureBossIntroActorsActive(false);
         if(param1)
         {
            this.StartBossIntroUi(param1);
         }
      }
  `, eol);

  const ensureMethod = normalizeBlock(`
      public function EnsureBossIntroActorsActive(param1:Boolean = true) : void
      {
         this.am_Boss.bHoldSpawn = false;
         this.am_Boss2.bHoldSpawn = false;
         this.am_Boss.bHoldEngage = false;
         this.am_Boss2.bHoldEngage = false;
         this.am_Boss.defeatTick = 0;
         this.am_Boss2.defeatTick = 0;
         if(!this.am_Boss.bSpawned && param1)
         {
            this.am_Boss.Spawn();
         }
         if(!this.am_Boss2.bSpawned && param1)
         {
            this.am_Boss2.Spawn();
         }
         this.am_Boss.Sleep();
         this.am_Boss2.Sleep();
         this.am_Boss.Revive();
         this.am_Boss2.Revive();
         this.am_Boss.Aggro();
         this.am_Boss2.Aggro();
      }
  `, eol);

  const gateMethod = normalizeBlock(`
      public function UpdateBossIntroGate(param1:a_GameHook) : void
      {
         this.am_Boss.defeatTick = 0;
         this.am_Boss2.defeatTick = 0;
         this.bBossIntroActorsSpawned = this.am_Boss.bSpawned && this.am_Boss2.bSpawned;
         if(!this.am_Boss2.bSpawned && param1.AtTime(16250))
         {
            this.SpawnBoss2IntroHeld();
         }
         if(!this.am_Boss.bSpawned && param1.AtTime(19000))
         {
            this.SpawnBoss1IntroHeld();
         }
         this.bBossIntroActorsSpawned = this.am_Boss.bSpawned && this.am_Boss2.bSpawned;
         if(!param1.OnScriptFinish(param1.cutSceneStartBoss) && !param1.AtTime(30000))
         {
            if(this.bBossIntroActorsSpawned)
            {
               this.HoldBossIntroActors();
            }
            return;
         }
         if(!this.bBossIntroActorsSpawned)
         {
            this.SpawnBossIntroActorsHeld();
         }
         this.HoldBossIntroActors();
         this.ReleaseBossIntroActors(param1);
         param1.SetPhase(this.UpdatePhaseOne);
      }
  `, eol);

  const startUiMethod = normalizeBlock(`
      public function StartBossIntroUi(param1:a_GameHook) : void
      {
         var _loc2_:* = null;
         var _loc3_:* = null;
         var _loc4_:uint = 0;
         var _loc5_:uint = 0;
         if(!param1 || !param1.linkToRoom)
         {
            return;
         }
         _loc2_ = param1.linkToRoom.method_35("am_Boss");
         _loc3_ = param1.linkToRoom.method_35("am_Boss2");
         if(_loc2_)
         {
            _loc4_ = uint(_loc2_.id);
         }
         if(_loc3_)
         {
            _loc5_ = uint(_loc3_.id);
         }
         if(_loc4_ || _loc5_)
         {
            param1.linkToRoom.method_903(_loc4_,this.am_Boss.displayName,_loc5_,this.am_Boss2.displayName);
         }
      }
  `, eol);

  const finishMethod = normalizeBlock(`
      public function FinishBossFightStory(param1:a_GameHook) : void
      {
         this.am_PowerMarker1.Remove();
         this.am_PowerMarker2.Remove();
         param1.bDoubleBossFight = false;
         if(param1 && param1.linkToRoom)
         {
            param1.linkToRoom.method_876();
         }
         param1.PlayCutScene(param1.cutSceneDefeatBoss);
         param1.SetPhase(this.UpdateBossDefeatGate);
      }
  `, eol);

  const defeatGateMethod = normalizeBlock(`
      public function UpdateBossDefeatGate(param1:a_GameHook) : void
      {
         if(param1.OnScriptFinish(param1.cutSceneDefeatBoss) || param1.AtTime(12000))
         {
            param1.SetPhase(null);
         }
      }
  `, eol);

  const marker = `      public function UpdatePhaseOne(param1:a_GameHook) : void${eol}`;
  if (!patched.includes(marker)) {
    throw new Error('Could not find UpdatePhaseOne insertion point');
  }

  if (patched.includes('public function HoldBossIntroActors(')) {
    patched = replaceMethod(patched, 'HoldBossIntroActors', holdMethod);
  } else {
    patched = patched.replace(marker, `${holdMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function SpawnBoss2IntroHeld(')) {
    patched = replaceMethod(patched, 'SpawnBoss2IntroHeld', spawnSecondMethod);
  } else {
    patched = patched.replace(marker, `${spawnSecondMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function SpawnBoss1IntroHeld(')) {
    patched = replaceMethod(patched, 'SpawnBoss1IntroHeld', spawnFirstMethod);
  } else {
    patched = patched.replace(marker, `${spawnFirstMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function SpawnBossIntroActorsHeld(')) {
    patched = replaceMethod(patched, 'SpawnBossIntroActorsHeld', spawnHeldMethod);
  } else {
    patched = patched.replace(marker, `${spawnHeldMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function ReleaseBossIntroActors(')) {
    patched = replaceMethod(patched, 'ReleaseBossIntroActors', releaseMethod);
  } else {
    patched = patched.replace(marker, `${releaseMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function EnsureBossIntroActorsActive(')) {
    patched = replaceMethod(patched, 'EnsureBossIntroActorsActive', ensureMethod);
  } else {
    patched = patched.replace(marker, `${ensureMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function UpdateBossIntroGate(')) {
    patched = replaceMethod(patched, 'UpdateBossIntroGate', gateMethod);
  } else {
    patched = patched.replace(marker, `${gateMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function StartBossIntroUi(')) {
    patched = replaceMethod(patched, 'StartBossIntroUi', startUiMethod);
  } else {
    patched = patched.replace(marker, `${startUiMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function FinishBossFightStory(')) {
    patched = replaceMethod(patched, 'FinishBossFightStory', finishMethod);
  } else {
    patched = patched.replace(marker, `${finishMethod}${eol}      ${eol}${marker}`);
  }

  if (patched.includes('public function UpdateBossDefeatGate(')) {
    patched = replaceMethod(patched, 'UpdateBossDefeatGate', defeatGateMethod);
  } else {
    patched = patched.replace(marker, `${defeatGateMethod}${eol}      ${eol}${marker}`);
  }

  if (!patched.includes('if(param1.AtTime(250))')) {
    patched = patched.replace(
      `         if(param1.AtTime(0))${eol}         {${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`,
      `         if(param1.AtTime(0))${eol}         {${eol}            this.ReleaseBossIntroActors(param1);${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`
    );
    patched = patched.replace(
      `            this.am_PowerMarker1.Spawn();${eol}         }${eol}         if(param1.AtTime(800))`,
      `            this.am_PowerMarker1.Spawn();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(250))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(500))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTimeRepeat(2000,2000))${eol}         {${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(800))`
    );
  }
  patched = patched.replace(
    `            this.EnsureBossIntroActorsActive();${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`,
    `            this.ReleaseBossIntroActors(param1);${eol}            this.EnsureBossIntroActorsActive();${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`
  );
  patched = patched.replace(
    `            this.ReleaseBossIntroActors();${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`,
    `            this.ReleaseBossIntroActors(param1);${eol}            this.EnsureBossIntroActorsActive();${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`
  );
  patched = patched.replace(
    `            this.ReleaseBossIntroActors(param1);${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`,
    `            this.ReleaseBossIntroActors(param1);${eol}            this.EnsureBossIntroActorsActive();${eol}            this.am_Boss.AddBuff("GolemMagicArmor");`
  );
  if (patched.includes('if(param1.AtTime(250))') && !patched.includes('if(param1.GetTime() < 2500)')) {
    patched = patched.replace(
      `         if(param1.AtTime(250))`,
      `         if(param1.GetTime() < 2500)${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(250))`
    );
  }
  if (patched.includes('if(param1.AtTime(250))') && !patched.includes('if(param1.AtTime(500))')) {
    patched = patched.replace(
      `         if(param1.AtTime(250))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}         }${eol}         if(param1.AtTime(800))`,
      `         if(param1.AtTime(250))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(500))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTimeRepeat(2000,2000))${eol}         {${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(800))`
    );
  }
  patched = patched.replace(
    `         if(param1.AtTime(250))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}         }`,
    `         if(param1.AtTime(250))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }`
  );
  patched = patched.replace(
    `         if(param1.AtTime(500))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}         }`,
    `         if(param1.AtTime(500))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }`
  );
  if (patched.includes('if(param1.AtTime(500))') && !patched.includes('if(param1.AtTimeRepeat(2000,2000))')) {
    patched = patched.replace(
      `         if(param1.AtTime(500))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(800))`,
      `         if(param1.AtTime(500))${eol}         {${eol}            this.EnsureBossIntroActorsActive();${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTimeRepeat(2000,2000))${eol}         {${eol}            this.StartBossIntroUi(param1);${eol}         }${eol}         if(param1.AtTime(800))`
    );
  }
  patched = patched.replace(
    `            this.am_PowerMarker1.Spawn();${eol}         }`,
    `            this.am_PowerMarker1.Spawn();${eol}            this.StartBossIntroUi(param1);${eol}         }`
  );
  if (!patched.includes('this.bBossIntroActorsSpawned = false;')) {
    patched = patched.replace(
      `         this.bMageLeaving = false;`,
      `         this.bMageLeaving = false;${eol}         this.bBossIntroActorsSpawned = false;`
    );
  }

  const autoRemoveMarkers = [
    `            this.am_Mage.Remove();${eol}            this.bMageLeaving = false;`,
    `            this.am_PowerMarker1.Remove();${eol}            this.am_Mage.Remove();${eol}            param1.SetPhase(null);`,
    `            this.am_PowerMarker1.Remove();${eol}            this.am_Mage.Remove();${eol}            param1.SetPhase(this.UpdatePhaseMeleeEnraged);`,
    `            this.am_Mage.Remove();${eol}            param1.SetPhase(this.UpdatePhaseCasterEnraged);`
  ];
  const autoRemoveReplacements = [
    `            this.bMageLeaving = false;`,
    `            this.am_PowerMarker1.Remove();${eol}            param1.SetPhase(null);`,
    `            this.am_PowerMarker1.Remove();${eol}            param1.SetPhase(this.UpdatePhaseMeleeEnraged);`,
    `            param1.SetPhase(this.UpdatePhaseCasterEnraged);`
  ];
  for (let index = 0; index < autoRemoveMarkers.length; index += 1) {
    patched = patched.replace(autoRemoveMarkers[index], autoRemoveReplacements[index]);
  }
  patched = patched.replace(
    `            this.am_PowerMarker1.Remove();${eol}            param1.SetPhase(null);${eol}            return;`,
    `            this.FinishBossFightStory(param1);${eol}            return;`
  );
  patched = patched.replace(
    `            this.am_PowerMarker1.Remove();${eol}            this.am_PowerMarker2.Remove();${eol}            param1.SetPhase(null);${eol}            return;`,
    `            this.FinishBossFightStory(param1);${eol}            return;`
  );
  patched = patched.replace(
    `            param1.SetPhase(null);${eol}            return;`,
    `            this.FinishBossFightStory(param1);${eol}            return;`
  );
  patched = patched.replace(
    `            this.am_PowerMarker1.Remove();${eol}            this.am_PowerMarker2.Remove();${eol}            this.FinishBossFightStory(param1);`,
    `            this.FinishBossFightStory(param1);`
  );

  verifyRoomSource(patched, 'patched source');
  return patched;
}

function verifyRoomSource(source, label) {
  const required = [
    'public var bBossIntroFinished:Boolean;',
    'public var bBossIntroActorsSpawned:Boolean;',
    'this.am_Boss.bHoldEngage = true;',
    'this.am_Boss2.bHoldEngage = true;',
    'this.bBossIntroFinished = false;',
    'this.bBossIntroActorsSpawned = false;',
    'this.HoldBossIntroActors();',
    'param1.bDoubleBossFight = true;',
    'param1.OnTrigger("am_Trigger_Boss")',
    'param1.bossFightBeginsWhenThisGuyIsDead = null;',
    'param1.bossFightPhase = null;',
    'param1.PlayCutScene(param1.cutSceneStartBoss);',
    'param1.SetPhase(this.UpdateBossIntroGate);',
    'this.am_LastGuy.Remove();',
    'public function HoldBossIntroActors() : void',
    'this.am_Boss.DeepSleep();',
    'this.am_Boss2.DeepSleep();',
    'this.am_Boss.ClearHate();',
    'this.am_Boss2.ClearHate();',
    'public function SpawnBoss2IntroHeld() : void',
    'public function SpawnBoss1IntroHeld() : void',
    'public function SpawnBossIntroActorsHeld() : void',
    '1 Boss2 <Melee>',
    '1 Boss <Melee>',
    'param1.bDoubleBossFight = true;',
    'if(!this.am_Boss.bSpawned && param1)',
    'if(!this.am_Boss2.bSpawned && param1)',
    'public function ReleaseBossIntroActors(param1:a_GameHook = null) : void',
    'this.bBossIntroFinished = true;',
    'this.am_Boss.bHoldSpawn = false;',
    'this.am_Boss2.bHoldSpawn = false;',
    'this.am_Boss.bHoldEngage = false;',
    'this.am_Boss2.bHoldEngage = false;',
    'this.am_Boss.Sleep();',
    'this.am_Boss2.Sleep();',
    'this.am_Boss.defeatTick = 0;',
    'this.am_Boss2.defeatTick = 0;',
    'this.am_Boss.Revive();',
    'this.am_Boss2.Revive();',
    'public function EnsureBossIntroActorsActive(param1:Boolean = true) : void',
    'this.EnsureBossIntroActorsActive();',
    'if(param1.GetTime() < 2500)',
    'if(param1.AtTime(250))',
    'if(param1.AtTime(500))',
    'this.am_Boss.Aggro();',
    'this.am_Boss2.Aggro();',
    'this.ReleaseBossIntroActors(param1);',
    'public function UpdateBossIntroGate(param1:a_GameHook) : void',
    'this.SpawnBossIntroActorsHeld();',
    'this.SpawnBoss2IntroHeld();',
    'this.SpawnBoss1IntroHeld();',
    'param1.AtTime(16250)',
    'param1.AtTime(19000)',
    'param1.SetPhase(this.UpdatePhaseOne);',
    'public function StartBossIntroUi(param1:a_GameHook) : void',
    'param1.linkToRoom.method_903(_loc4_,this.am_Boss.displayName,_loc5_,this.am_Boss2.displayName);',
    'public function FinishBossFightStory(param1:a_GameHook) : void',
    'param1.bDoubleBossFight = false;',
    'param1.linkToRoom.method_876();',
    'public function UpdateBossDefeatGate(param1:a_GameHook) : void',
    'this.FinishBossFightStory(param1);'
  ];

  for (const marker of required) {
    if (!source.includes(marker)) {
      throw new Error(`${label} is missing required marker: ${marker}`);
    }
  }

  if (
    !source.includes('this.bBossIntroActorsSpawned = this.am_Boss.bSpawned && this.am_Boss2.bSpawned;') &&
    !source.includes('this.bBossIntroActorsSpawned = Boolean(this.am_Boss.bSpawned) && Boolean(this.am_Boss2.bSpawned);')
  ) {
    throw new Error(`${label} is missing required boss intro spawn-state gate`);
  }

  const forbidden = [
    'this.am_Mage.Remove();',
    'this.am_Boss.Remove();',
    'this.am_Boss2.Remove();',
    'param1.bossFightBeginsWhenThisGuyIsDead = "am_LastGuy";',
    'param1.bossFightPhase = this.UpdateBossIntroGate;',
    'param1.bossFightPhase = this.UpdatePhaseOne;',
    'this.am_LastGuy.Kill();',
    'SpawnCue Boss2',
    'SpawnCue Boss'
  ];
  for (const marker of forbidden) {
    if (source.includes(marker)) {
      throw new Error(`${label} still contains unsafe boss intro marker: ${marker}`);
    }
  }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelsjc-back-alley-boss-cutscene-gate', path.basename(swfPath, path.extname(swfPath)));
  const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  const original = fs.readFileSync(roomPath, 'utf8');
  const patched = patchRoomSource(original);

  if (patched === original) {
    console.log(`SWF already contains the Back Alley boss cutscene gate patch: ${swfPath}`);
    return;
  }

  fs.writeFileSync(roomPath, patched, 'utf8');
  runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(roomPath)]);
  fs.copyFileSync(patchedSwfPath, swfPath);
  console.log(`Patched Back Alley boss cutscene gate in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelsjc-back-alley-boss-cutscene-gate-verify', path.basename(swfPath, path.extname(swfPath)));
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  verifyRoomSource(fs.readFileSync(roomPath, 'utf8'), swfPath);
  console.log(`Verified Back Alley boss cutscene gate in ${swfPath}`);
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
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
}
