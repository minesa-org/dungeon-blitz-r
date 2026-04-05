#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGETS = [
    {
        swf: path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'LevelsHome.swf')
    }
];

function parseArgs(argv) {
    const args = {
        ffdec: '',
        verify: false,
        swfs: []
    };

    for (let index = 2; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--ffdec' || arg === '-f') {
            args.ffdec = argv[++index] || '';
            continue;
        }
        if (arg === '--swf' || arg === '-s') {
            args.swfs.push(argv[++index] || '');
            continue;
        }
        if (arg === '--verify') {
            args.verify = true;
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return args;
}

function printHelp() {
    console.log(
        [
            'Usage:',
            '  node src/server/scripts/patch-levelshome-keep-tutorial.js [--verify] [--swf <path>] [--ffdec <path>]',
            '',
            'Patches a_Room_MainTutorial inside LevelsHome.swf so:',
            '  - Ranik intro uses Run Loop instead of sliding',
            '  - the first reinforcement wave spawns 3 goblins at once',
            '  - later reinforcement respawns come back in 2-3 goblin waves instead of one-by-one'
        ].join('\n')
    );
}

function resolveRepoRoot() {
    return path.resolve(__dirname, '..', '..', '..');
}

function resolvePath(repoRoot, value) {
    if (!value) {
        return '';
    }
    if (path.isAbsolute(value)) {
        return value;
    }
    return path.join(repoRoot, value);
}

function detectFfdec(repoRoot, preferred) {
    const candidates = [];
    if (preferred) {
        candidates.push(resolvePath(repoRoot, preferred));
    }

    candidates.push(
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec-cli.jar'),
        '/Applications/FFDec.app/Contents/Resources/ffdec.sh',
        '/Applications/FFDec.app/Contents/Resources/ffdec.jar',
        '/Applications/FFDec.app/Contents/Resources/ffdec-cli.jar'
    );

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return '';
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

function replaceExact(source, needle, replacement, label) {
    if (!source.includes(needle)) {
        throw new Error(`Could not find ${label} in a_Room_MainTutorial.as`);
    }
    return source.replace(needle, replacement);
}

function exportRoomScript(ffdecPath, workRoot, swfPath) {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(ffdecPath, ['-selectclass', 'a_Room_MainTutorial', '-export', 'script', workRoot, swfPath]);

    const classPath = path.join(workRoot, 'scripts', 'a_Room_MainTutorial.as');
    if (!fs.existsSync(classPath)) {
        throw new Error(`FFDec export did not produce ${classPath}`);
    }

    return classPath;
}

function patchSource(source) {
    let patched = source.replace(/\r\n/g, '\n');

    patched = replaceExact(
        patched,
        `      public var bWounded2:Boolean = false;\n`,
        `      public var bWounded2:Boolean = false;\n      \n      public var bInitialWave:Boolean = false;\n      \n      public var bUseSmallWave:Boolean = false;\n`,
        'wave state fields'
    );

    patched = replaceExact(
        patched,
        `         this.bWounded = false;\n         this.bWounded2 = false;\n`,
        `         this.bWounded = false;\n         this.bWounded2 = false;\n         this.bInitialWave = false;\n         this.bUseSmallWave = false;\n`,
        'wave reset block'
    );

    patched = replaceExact(
        patched,
        `         param1.cutSceneStartBoss = ["0 Camera 1","5 OldManTutorial Thank the stars you\\'re here!","14 OldManTutorial The goblins have ruined the keep.","14 OldManTutorial I was the caretaker here...","6 Parrot <Goto Red 1> Look out!","2 SpawnCue Boss","2 Boss <Goto Red 2> Stop the human!","10 Boss Don\\'t let him|her take our home!","6 Camera Free"];\n`,
        `         param1.cutSceneStartBoss = ["0 Camera 1","5 OldManTutorial Thank the stars you\\'re here!","14 OldManTutorial The goblins have ruined the keep.","14 OldManTutorial I was the caretaker here...","6 Parrot <Goto Red 1> Look out!","2 SpawnCue Boss","2 Boss <Run Loop><Goto Red 2> Stop the human!","10 Boss <End> Don\\'t let him|her take our home!","6 Camera Free"];\n`,
        'boss intro cutscene'
    );

    patched = replaceExact(
        patched,
        `      public function UpdateBossFight(param1:a_GameHook) : void\n      {\n         var _loc2_:a_Cue = null;\n         if(!param1.OnScriptFinish(param1.cutSceneStartBoss))\n         {\n            return;\n         }\n         this.am_Boss.visible = true;\n         this.am_Boss.RemoveBuff("Untouchable");\n         if(this.am_Boss.Defeated())\n         {\n            param1.Group(this.am_MonsterGroup).Kill();\n            this.monsterList = null;\n            param1.SetPhase(null);\n            return;\n         }\n         if(!this.bWounded && this.am_Boss.Health() < 0.6)\n         {\n            this.bWounded = true;\n            this.SummonReinforcements(param1,"To me! Protect your home!");\n         }\n         if(!this.bWounded2 && this.am_Boss.Health() < 0.3)\n         {\n            this.bWounded2 = true;\n            this.SummonReinforcements(param1,"I will not fall! To me, brothers!");\n         }\n         if(param1.AtTimeRepeat(2000,0))\n         {\n            _loc2_ = this.monsterList[this.spawnIndex];\n            if(!_loc2_.Health())\n            {\n               _loc2_.Remove();\n               _loc2_.Spawn();\n               _loc2_.Aggro();\n               this.spawnIndex = this.spawnIndex < this.numMonsters - 1 ? uint(this.spawnIndex + 1) : 0;\n            }\n         }\n      }\n      \n      public function SummonReinforcements(param1:a_GameHook, msg:String) : void\n      {\n         var _loc3_:a_Cue = null;\n         var _loc4_:Number = 0;\n         while(_loc4_ < this.numMonsters)\n         {\n            _loc3_ = this.monsterList[_loc4_];\n            if(!_loc3_.Health())\n            {\n               _loc3_.Remove();\n               _loc3_.Spawn();\n               _loc3_.Aggro();\n            }\n            _loc4_++;\n         }\n      }\n`,
        `      public function UpdateBossFight(param1:a_GameHook) : void\n      {\n         if(!param1.OnScriptFinish(param1.cutSceneStartBoss))\n         {\n            return;\n         }\n         this.am_Boss.visible = true;\n         this.am_Boss.RemoveBuff("Untouchable");\n         if(this.am_Boss.Defeated())\n         {\n            param1.Group(this.am_MonsterGroup).Kill();\n            this.monsterList = null;\n            param1.SetPhase(null);\n            return;\n         }\n         if(!this.bInitialWave)\n         {\n            this.bInitialWave = true;\n            this.SpawnMonsterWave(3);\n         }\n         if(!this.bWounded && this.am_Boss.Health() < 0.6)\n         {\n            this.bWounded = true;\n            this.SummonReinforcements(param1,"To me! Protect your home!");\n         }\n         if(!this.bWounded2 && this.am_Boss.Health() < 0.3)\n         {\n            this.bWounded2 = true;\n            this.SummonReinforcements(param1,"I will not fall! To me, brothers!");\n         }\n         if(param1.AtTimeRepeat(2000,0) && this.CountLivingReinforcements() == 0)\n         {\n            this.SpawnMonsterWave(this.bUseSmallWave ? 2 : 3);\n            this.bUseSmallWave = !this.bUseSmallWave;\n         }\n      }\n      \n      public function CountLivingReinforcements() : uint\n      {\n         var _loc1_:a_Cue = null;\n         var _loc2_:uint = 0;\n         var _loc3_:uint = 0;\n         while(_loc3_ < this.numMonsters)\n         {\n            _loc1_ = this.monsterList[_loc3_];\n            if(Boolean(_loc1_) && Boolean(_loc1_.Health()))\n            {\n               _loc2_++;\n            }\n            _loc3_++;\n         }\n         return _loc2_;\n      }\n      \n      public function SpawnMonsterWave(param1:uint) : void\n      {\n         var _loc2_:a_Cue = null;\n         var _loc3_:uint = this.spawnIndex;\n         var _loc4_:uint = 0;\n         var _loc5_:uint = 0;\n         while(_loc4_ < this.numMonsters && _loc5_ < param1)\n         {\n            _loc2_ = this.monsterList[_loc3_];\n            if(Boolean(_loc2_) && !_loc2_.Health())\n            {\n               _loc2_.Remove();\n               _loc2_.Spawn();\n               _loc2_.Aggro();\n               _loc5_++;\n            }\n            _loc3_ = _loc3_ < this.numMonsters - 1 ? uint(_loc3_ + 1) : 0;\n            _loc4_++;\n         }\n         this.spawnIndex = _loc3_;\n      }\n      \n      public function SummonReinforcements(param1:a_GameHook, msg:String) : void\n      {\n         this.SpawnMonsterWave(3);\n      }\n`,
        'boss fight reinforcement methods'
    );

    return patched.endsWith('\n') ? patched : `${patched}\n`;
}

function verifyPatchedSource(source, swfPath) {
    const normalized = source.replace(/\r\n/g, '\n');
    const checks = [
        'public var bInitialWave:Boolean = false;',
        'public var bUseSmallWave:Boolean = false;',
        'Boss <Run Loop><Goto Red 2> Stop the human!',
        'Boss <End> Don\\\'t let him|her take our home!',
        'this.SpawnMonsterWave(3);',
        'this.CountLivingReinforcements() == 0',
        'this.SpawnMonsterWave(this.bUseSmallWave ? 2 : 3);'
    ];

    for (const check of checks) {
        if (!normalized.includes(check)) {
            throw new Error(`${path.basename(swfPath)} is missing expected patch content: ${check}`);
        }
    }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(repoRoot, 'build', 'ffdec-levelshome-keep-tutorial', path.basename(swfPath, path.extname(swfPath)));
    const classPath = exportRoomScript(ffdecPath, workRoot, swfPath);
    const scriptsRoot = path.dirname(classPath);
    const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);

    const originalSource = fs.readFileSync(classPath, 'utf8');
    const patchedSource = patchSource(originalSource);
    verifyPatchedSource(patchedSource, swfPath);
    fs.writeFileSync(classPath, patchedSource, 'utf8');

    runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, scriptsRoot]);
    fs.copyFileSync(patchedSwfPath, swfPath);
    console.log(`Patched keep tutorial room logic in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(repoRoot, 'build', 'ffdec-levelshome-keep-tutorial-verify', path.basename(swfPath, path.extname(swfPath)));
    const classPath = exportRoomScript(ffdecPath, workRoot, swfPath);
    verifyPatchedSource(fs.readFileSync(classPath, 'utf8'), swfPath);
    console.log(`Verified keep tutorial room logic in ${swfPath}`);
}

function main() {
    const repoRoot = resolveRepoRoot();
    const args = parseArgs(process.argv);
    const ffdecPath = detectFfdec(repoRoot, args.ffdec);

    if (!ffdecPath) {
        throw new Error('FFDec not found. Pass --ffdec or install JPEXS FFDec.');
    }

    const requestedSwfs = new Set((args.swfs.length ? args.swfs : TARGETS.map((target) => target.swf)).map((entry) => resolvePath(repoRoot, entry)));
    const selectedTargets = TARGETS
        .map((target) => resolvePath(repoRoot, target.swf))
        .filter((swfPath) => requestedSwfs.has(swfPath));

    if (!selectedTargets.length) {
        throw new Error('No matching SWFs selected for patching.');
    }

    for (const swfPath of selectedTargets) {
        if (!fs.existsSync(swfPath)) {
            throw new Error(`SWF not found: ${swfPath}`);
        }
    }

    if (args.verify) {
        for (const swfPath of selectedTargets) {
            verifySwf(repoRoot, ffdecPath, swfPath);
        }
        return;
    }

    for (const swfPath of selectedTargets) {
        patchSwf(repoRoot, ffdecPath, swfPath);
    }
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
