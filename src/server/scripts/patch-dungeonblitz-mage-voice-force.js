#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGET_SWFS = [
    path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf')
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
            '  node src/server/scripts/patch-dungeonblitz-mage-voice-force.js [--verify] [--swf <path>] [--ffdec <path>]',
            '',
            'Defaults:',
            '  patches ActivePower in the served DungeonBlitz SWF',
            '  so male mage casts force-replace known female-only voice tokens with male mage fallback grunts.'
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
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec-cli.jar'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec-cli.jar'),
        '/Applications/FFDec.app/Contents/Resources/ffdec.jar',
        '/Applications/FFDec.app/Contents/Resources/ffdec-cli.jar',
        path.join(repoRoot, 'temp', 'jpexs_25_1_3', 'FFDec.app', 'Contents', 'Resources', 'ffdec.jar'),
        path.join(repoRoot, 'temp', 'jpexs_25_1_3', 'FFDec.app', 'Contents', 'Resources', 'ffdec-cli.jar'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.sh'),
        '/Applications/FFDec.app/Contents/Resources/ffdec.sh',
        path.join(repoRoot, 'temp', 'jpexs_25_1_3', 'FFDec.app', 'Contents', 'Resources', 'ffdec.sh')
    );

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return '';
}

function ensureFfdecHome(repoRoot) {
    const ffdecHome = path.join(repoRoot, 'build', 'ffdec-home');
    fs.mkdirSync(path.join(ffdecHome, 'Library', 'Application Support', 'FFDec', 'logs'), { recursive: true });
    return ffdecHome;
}

function runFfdec(ffdecPath, repoRoot, args) {
    const resolved = path.resolve(ffdecPath);
    const basename = path.basename(resolved).toLowerCase();
    const ffdecHome = ensureFfdecHome(repoRoot);
    const env = {
        ...process.env,
        HOME: ffdecHome
    };

    if (basename.endsWith('.jar')) {
        execFileSync('java', [`-Duser.home=${ffdecHome}`, '-jar', resolved, '-cli', ...args], {
            stdio: 'inherit',
            env
        });
        return;
    }

    execFileSync(resolved, ['-cli', ...args], {
        stdio: 'inherit',
        env
    });
}

function exportActivePower(repoRoot, ffdecPath, workRoot, swfPath) {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(ffdecPath, repoRoot, ['-selectclass', 'ActivePower', '-export', 'script', workRoot, swfPath]);

    const classPath = path.join(workRoot, 'scripts', 'ActivePower.as');
    if (!fs.existsSync(classPath)) {
        throw new Error(`FFDec export did not produce ${classPath}`);
    }

    return classPath;
}

function getTemplateActivePowerSource(repoRoot) {
    const candidates = [
        path.join(repoRoot, 'build', 'extracted', 'dungeonblitz-localhost-hotbar-all', 'scripts', 'ActivePower.as'),
        path.join(repoRoot, 'build', 'ffdec-chat-all', 'scripts', 'ActivePower.as'),
        path.join(repoRoot, 'build', 'verify', 'dungeonblitz-localhost-mountslotfix-export', 'scripts', 'ActivePower.as')
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return fs.readFileSync(candidate, 'utf8');
        }
    }

    throw new Error('Template ActivePower.as not found in extracted build artifacts.');
}

function replaceExact(source, needle, replacement, label) {
    if (source.includes(replacement)) {
        return source;
    }
    if (!source.includes(needle)) {
        throw new Error(`Could not find patch marker: ${label}`);
    }
    return source.replace(needle, replacement);
}

function patchActivePower(source) {
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const join = (lines) => lines.join(eol);

    const brokenTargetBlock = join([
        '            if(_loc20_)',
        '            {',
        '               var _loc21_:int = this.var_33 ? int(null.indexOf(this.var_33)) : -1;',
        '               if(_loc21_ >= 0)',
        '               {',
        '                  return new Array(this.var_33);',
        '               }',
        '               if(true)',
        '               {',
        '                  return new Array();',
        '               }',
        '               return new Array(null[0]);',
        '            }'
    ]);
    const fixedTargetBlock = join([
        '            if(_loc20_)',
        '            {',
        '               var _loc21_:int = this.var_33 ? int(_loc20_.indexOf(this.var_33)) : -1;',
        '               if(_loc21_ >= 0)',
        '               {',
        '                  return new Array(this.var_33);',
        '               }',
        '               if(!_loc20_.length)',
        '               {',
        '                  return new Array();',
        '               }',
        '               return new Array(_loc20_[0]);',
        '            }'
    ]);

    const helperAnchor = join([
        '      public function method_129() : void',
        '      {'
    ]);
    const helperPatched = join([
        '      private function method_2981(param1:String) : String',
        '      {',
        '         var _loc2_:String = null;',
        '         var _loc3_:uint = 0;',
        '         if(!param1 || !this.var_4 || !this.var_4.entType || this.var_4.entType.className != "Mage" || this.var_4.entType.var_620 || !(this.var_4.var_20 & Entity.PLAYER))',
        '         {',
        '            return param1;',
        '         }',
        '         if(param1.indexOf("snd_pwr_mage_poisoncloud_vox") == -1 && param1.indexOf("snd_pwr_mage_hailStorm_new__vox") == -1)',
        '         {',
        '            return param1;',
        '         }',
        '         _loc3_ = 1 + uint(Math.random() * 3);',
        '         _loc2_ = "snd_hurt_mage_0" + _loc3_ + "_male";',
        '         param1 = param1.split("snd_pwr_mage_poisoncloud_vox").join(_loc2_);',
        '         param1 = param1.split("snd_pwr_mage_hailStorm_new__vox").join(_loc2_);',
        '         return param1;',
        '      }',
        '      ',
        '      private function method_2982(param1:String) : String',
        '      {',
        '         if(!param1 || !this.powerType || !this.var_4 || !this.var_4.entType || this.var_4.entType.className != "Mage" || this.var_4.entType.var_620 || !(this.var_4.var_20 & Entity.PLAYER))',
        '         {',
        '            return param1;',
        '         }',
        '         if(param1 == "CallPet" && (this.powerType.basePowerName == "SummonPet" || this.powerType.basePowerName == "VanityPet"))',
        '         {',
        '            return "Summon";',
        '         }',
        '         return param1;',
        '      }',
        '      ',
        '      public function method_129() : void',
        '      {'
    ]);

    const animOriginal = join([
        '            if(this.powerType.var_136 != "Melee")',
        '            {',
        '               this.var_4.gfx.m_Seq.method_34(Seq.C_USEPOWER,this.powerType.var_136,this.powerType.var_801);',
        '            }'
    ]);
    const animPatched = join([
        '            if(this.powerType.var_136 != "Melee")',
        '            {',
        '               var _loc4_:String = this.method_2982(this.powerType.var_136);',
        '               this.var_4.gfx.m_Seq.method_34(Seq.C_USEPOWER,_loc4_,this.powerType.var_801);',
        '            }'
    ]);

    const soundOriginal = join([
        '               _loc12_ = Boolean(_loc11_.var_2331) && this.var_4.entType.var_620 ? _loc11_.var_2331 : _loc11_.soundName;',
        '               this.var_1.method_82(_loc12_,this.var_4.var_10,this.var_4.var_12);'
    ]);
    const soundPatched = join([
        '               _loc12_ = Boolean(_loc11_.var_2331) && this.var_4.entType.var_620 ? _loc11_.var_2331 : _loc11_.soundName;',
        '               _loc12_ = this.method_2981(_loc12_);',
        '               this.var_1.method_82(_loc12_,this.var_4.var_10,this.var_4.var_12);'
    ]);

    let patched = source;
    patched = replaceExact(patched, brokenTargetBlock, fixedTargetBlock, 'ActivePower FFDec target block cleanup');
    patched = replaceExact(patched, helperAnchor, helperPatched, 'ActivePower male mage voice helper');
    patched = replaceExact(patched, animOriginal, animPatched, 'ActivePower pet summon animation override');
    patched = replaceExact(patched, soundOriginal, soundPatched, 'ActivePower cast sound override');
    return patched;
}

function verifyPatchedActivePower(source, swfPath) {
    const requiredSnippets = [
        'private function method_2981(param1:String) : String',
        'private function method_2982(param1:String) : String',
        'this.var_4.entType.className != "Mage"',
        'param1.indexOf("snd_pwr_mage_poisoncloud_vox") == -1',
        'param1.indexOf("snd_pwr_mage_hailStorm_new__vox") == -1',
        'param1 == "CallPet" && (this.powerType.basePowerName == "SummonPet" || this.powerType.basePowerName == "VanityPet")',
        '_loc2_ = "snd_hurt_mage_0" + _loc3_ + "_male";',
        'var _loc4_:String = this.method_2982(this.powerType.var_136);',
        '_loc12_ = this.method_2981(_loc12_);'
    ];

    for (const snippet of requiredSnippets) {
        if (!source.includes(snippet)) {
            throw new Error(`${path.basename(swfPath)} is missing required snippet: ${snippet}`);
        }
    }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-dungeonblitz-mage-voice-force',
        path.basename(swfPath, path.extname(swfPath))
    );
    const scriptsRoot = path.join(workRoot, 'scripts');
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(scriptsRoot, { recursive: true });

    const original = getTemplateActivePowerSource(repoRoot);
    const patched = patchActivePower(original);

    if (patched === original) {
        console.log(`[mage-voice-force] ActivePower template already patched for ${path.basename(swfPath)}`);
        return;
    }

    const activePowerPath = path.join(scriptsRoot, 'ActivePower.as');
    fs.writeFileSync(activePowerPath, patched, 'utf8');
    const patchedSwfPath = path.join(path.dirname(swfPath), `${path.basename(swfPath, path.extname(swfPath))}.mage-voice-force.swf`);
    runFfdec(ffdecPath, repoRoot, ['-importScript', swfPath, patchedSwfPath, scriptsRoot]);
    fs.copyFileSync(patchedSwfPath, swfPath);
    fs.rmSync(patchedSwfPath, { force: true });
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-dungeonblitz-mage-voice-force-verify',
        path.basename(swfPath, path.extname(swfPath))
    );
    const activePowerPath = exportActivePower(repoRoot, ffdecPath, workRoot, swfPath);
    verifyPatchedActivePower(fs.readFileSync(activePowerPath, 'utf8'), swfPath);
}

function resolveTargets(repoRoot, requestedSwfs) {
    const targets = requestedSwfs.length ? requestedSwfs : TARGET_SWFS;
    return targets.map((swfPath) => resolvePath(repoRoot, swfPath));
}

function main() {
    const args = parseArgs(process.argv);
    const repoRoot = resolveRepoRoot();
    const ffdecPath = detectFfdec(repoRoot, args.ffdec);

    if (!ffdecPath) {
        throw new Error('FFDec not found. Pass --ffdec or restore the repo-bundled FFDec app.');
    }

    for (const swfPath of resolveTargets(repoRoot, args.swfs)) {
        if (!fs.existsSync(swfPath)) {
            throw new Error(`SWF not found: ${swfPath}`);
        }

        if (args.verify) {
            verifySwf(repoRoot, ffdecPath, swfPath);
            continue;
        }

        patchSwf(repoRoot, ffdecPath, swfPath);
    }
}

try {
    main();
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
}
