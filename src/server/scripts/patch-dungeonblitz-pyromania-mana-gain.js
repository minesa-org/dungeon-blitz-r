const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGET_SWFS = [
    path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf')
];

function resolveRepoRoot() {
    let dir = path.resolve(__dirname, '..', '..', '..');
    while (dir !== path.dirname(dir)) {
        if (
            fs.existsSync(path.join(dir, 'package.json')) &&
            fs.existsSync(path.join(dir, 'src', 'client', 'content'))
        ) {
            return dir;
        }
        dir = path.dirname(dir);
    }
    throw new Error('Could not resolve repo root.');
}

function resolvePath(repoRoot, inputPath) {
    return path.isAbsolute(inputPath) ? inputPath : path.resolve(repoRoot, inputPath);
}

function parseArgs(argv) {
    const args = {
        verify: false,
        ffdec: '',
        swfs: []
    };

    for (let index = 2; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--verify' || arg === '--dry-run') {
            args.verify = true;
        } else if (arg === '--ffdec' || arg === '-f') {
            args.ffdec = argv[++index] || '';
        } else if (arg === '--swf' || arg === '-s') {
            args.swfs.push(argv[++index] || '');
        } else if (arg === '--help' || arg === '-h') {
            console.log([
                'Usage:',
                '  node src/server/scripts/patch-dungeonblitz-pyromania-mana-gain.js [--verify] [--swf <path>] [--ffdec <path>]',
                '',
                'Patches Entity.method_475 in the served DungeonBlitz SWF so activating',
                'Pyromania grants up to 10 master mana. Verification also checks the',
                'existing EndPyromania cooldown-after-expiry hook.'
            ].join('\n'));
            process.exit(0);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }

    return args;
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
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec-cli.jar'),
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

function runFfdec(repoRoot, ffdecPath, args) {
    const resolved = path.resolve(ffdecPath);
    const basename = path.basename(resolved).toLowerCase();
    const ffdecHome = path.join(repoRoot, 'build', 'ffdec-home');
    fs.mkdirSync(path.join(ffdecHome, 'JPEXS', 'FFDec', 'logs'), { recursive: true });
    fs.mkdirSync(path.join(ffdecHome, 'LocalAppData'), { recursive: true });
    fs.mkdirSync(path.join(ffdecHome, 'Library', 'Application Support', 'FFDec', 'logs'), { recursive: true });
    const env = {
        ...process.env,
        APPDATA: ffdecHome,
        HOME: ffdecHome,
        LOCALAPPDATA: path.join(ffdecHome, 'LocalAppData'),
        USERPROFILE: ffdecHome
    };

    if (basename.endsWith('.jar')) {
        execFileSync('java', [`-Duser.home=${ffdecHome}`, '-jar', resolved, '-cli', ...args], {
            env,
            stdio: 'inherit'
        });
        return;
    }

    execFileSync(resolved, ['-cli', ...args], {
        env,
        stdio: 'inherit'
    });
}

function exportEntity(ffdecPath, repoRoot, workRoot, swfPath) {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(repoRoot, ffdecPath, ['-selectclass', 'Entity', '-export', 'script', workRoot, swfPath]);

    const entityPath = path.join(workRoot, 'scripts', 'Entity.as');
    if (!fs.existsSync(entityPath)) {
        throw new Error(`FFDec export did not produce ${entityPath}`);
    }

    return entityPath;
}

function verifyEntitySource(source, swfPath) {
    if (!source.includes('class_14.powerTypesDict["EndPyromania"].coolDownTime')) {
        throw new Error(`${path.basename(swfPath)} Entity.method_475 is missing the EndPyromania cooldown hook.`);
    }
    if (!source.includes('Game.var_172.method_142(this,null,_loc6_,true,this.var_31);')) {
        throw new Error(`${path.basename(swfPath)} Entity.method_475 is missing the Pyromania mana gain hook.`);
    }
}

function fixEntityDecompileArtifacts(source) {
    return source
        .replace('               this.var_1.mOwnedMaterials[param1] = null;', '               this.var_1.mOwnedMaterials[param1] = _loc5_;')
        .replace('            null.var_181 += param2;', '            _loc5_.var_181 += param2;')
        .replace('_loc4_.displayName + null,_loc4_.var_139', '_loc4_.displayName + _loc6_,_loc4_.var_139')
        .replace('               class_119.method_144(null.am_StarRating,param1.var_2671);', '               class_119.method_144(_loc8_.am_StarRating,param1.var_2671);')
        .replace('               null.am_DreadMode.visible = true;', '               _loc8_.am_DreadMode.visible = true;')
        .replace('               null.am_DreadMode.visible = false;', '               _loc8_.am_DreadMode.visible = false;')
        .replace('               var _loc12_:MovieClip = null.am_FireGroup;', '               var _loc12_:MovieClip = _loc8_.am_FireGroup;')
        .replace('               null.gotoAndStop(0);', '               _loc12_.gotoAndStop(0);')
        .replace('               null.visible = false;', '               _loc12_.visible = false;')
        .replace('            MathUtil.method_2(null.am_Header,null);', '            MathUtil.method_2(_loc8_.am_Header,_loc10_);')
        .replace('            MathUtil.method_2(null.am_MapName,null);', '            MathUtil.method_2(_loc8_.am_MapName,_loc6_);')
        .replace('            null.x = param1.var_2280;', '            _loc7_.x = param1.var_2280;')
        .replace('            null.y = param1.var_2285;', '            _loc7_.y = param1.var_2285;')
        .replace('            _loc3_ = new class_33(this.var_1,null);', '            _loc3_ = new class_33(this.var_1,_loc7_);')
        .replace('               this.gfx.method_627(null.var_932,null.var_1235);', '               this.gfx.method_627(_loc11_.var_932,_loc11_.var_1235);')
        .replace('               this.gfx.method_325(null.var_932,null.var_1235);', '               this.gfx.method_325(_loc11_.var_932,_loc11_.var_1235);');
}

function patchEntitySource(source, swfPath) {
    source = fixEntityDecompileArtifacts(source);

    if (
        source.includes('class_14.powerTypesDict["EndPyromania"].coolDownTime') &&
        source.includes('Game.var_172.method_142(this,null,_loc6_,true,this.var_31);')
    ) {
        verifyEntitySource(source, swfPath);
        return source;
    }

    if (!source.includes('class_14.powerTypesDict["EndPyromania"].coolDownTime')) {
        const cooldownInsertionPoint = [
            '                  this.combatState.RemoveBuff(class_14.buffTypesDict[_loc5_]);',
            '               }',
            '               this.var_494 = false;'
        ].join('\r\n');
        const cooldownHook = [
            '                  this.combatState.RemoveBuff(class_14.buffTypesDict[_loc5_]);',
            '               }',
            '               _loc5_ = "Pyromania";',
            '               if(this.combatState.var_498)',
            '               {',
            '                  _loc5_ += this.combatState.var_498;',
            '               }',
            '               this.combatState.var_114[class_14.powerTypesDict[_loc5_].powerID] = this.var_1.mTimeThisTick + class_14.powerTypesDict["EndPyromania"].coolDownTime;',
            '               this.var_494 = false;'
        ].join('\r\n');

        if (!source.includes(cooldownInsertionPoint)) {
            throw new Error(`${path.basename(swfPath)} has an unexpected Entity.method_475 cooldown layout.`);
        }
        source = source.replace(cooldownInsertionPoint, cooldownHook);
    }

    if (!source.includes('Game.var_172.method_142(this,null,_loc6_,true,this.var_31);')) {
        const declaration = '         var _loc5_:String = null;';
        if (!source.includes(declaration)) {
            throw new Error(`${path.basename(swfPath)} has an unexpected Entity.method_475 local declaration layout.`);
        }
        if (!source.includes('         var _loc6_:Number = NaN;')) {
            source = source.replace(declaration, `${declaration}\r\n         var _loc6_:Number = NaN;`);
        }

        const activationMarker = '            this.var_494 = true;\r\n            this.ResetEntType(this.entType);';
        const manaGain = [
            '            this.var_494 = true;',
            '            _loc6_ = Math.min(10,this.const_156 - this.var_31);',
            '            if(_loc6_ > 0)',
            '            {',
            '               Game.var_172.method_142(this,null,_loc6_,true,this.var_31);',
            '               this.var_31 += _loc6_;',
            '               this.var_1.method_114(this.var_31);',
            '            }',
            '            this.ResetEntType(this.entType);'
        ].join('\r\n');

        if (!source.includes(activationMarker)) {
            throw new Error(`${path.basename(swfPath)} has an unexpected Entity.method_475 activation layout.`);
        }

        source = source.replace(activationMarker, manaGain);
    }
    verifyEntitySource(source, swfPath);
    return source;
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-pyromania-mana-gain',
        path.basename(swfPath, path.extname(swfPath))
    );
    const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
    const entityPath = exportEntity(ffdecPath, repoRoot, workRoot, swfPath);
    const originalSource = fs.readFileSync(entityPath, 'utf8');
    const patchedSource = patchEntitySource(originalSource, swfPath);

    if (patchedSource === originalSource) {
        console.log(`SWF already contains Pyromania mana gain: ${swfPath}`);
        return;
    }

    fs.writeFileSync(entityPath, patchedSource, 'utf8');
    runFfdec(repoRoot, ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.join(workRoot, 'scripts')]);
    const backupPath = `${swfPath}.bak`;
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(swfPath, backupPath);
    }
    fs.copyFileSync(patchedSwfPath, swfPath);
    verifySwf(repoRoot, ffdecPath, swfPath);
    console.log(`Patched Pyromania mana gain in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-pyromania-mana-gain-verify',
        path.basename(swfPath, path.extname(swfPath))
    );
    const entityPath = exportEntity(ffdecPath, repoRoot, workRoot, swfPath);
    verifyEntitySource(fs.readFileSync(entityPath, 'utf8'), swfPath);
    console.log(`Verified Pyromania mana gain in ${swfPath}`);
}

function main() {
    const repoRoot = resolveRepoRoot();
    const args = parseArgs(process.argv);
    const ffdecPath = detectFfdec(repoRoot, args.ffdec);
    if (!ffdecPath) {
        throw new Error('FFDec not found. Pass --ffdec or install JPEXS FFDec.');
    }

    const requestedSwfs = new Set((args.swfs.length ? args.swfs : TARGET_SWFS).map((entry) => resolvePath(repoRoot, entry)));
    const targets = TARGET_SWFS
        .map((swf) => resolvePath(repoRoot, swf))
        .filter((swf) => requestedSwfs.has(swf));

    if (!targets.length) {
        throw new Error('No matching SWFs selected for patching.');
    }
    for (const swfPath of targets) {
        if (!fs.existsSync(swfPath)) {
            throw new Error(`SWF not found: ${swfPath}`);
        }
    }

    for (const swfPath of targets) {
        if (args.verify) {
            verifySwf(repoRoot, ffdecPath, swfPath);
        } else {
            patchSwf(repoRoot, ffdecPath, swfPath);
        }
    }
}

try {
    main();
} catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
