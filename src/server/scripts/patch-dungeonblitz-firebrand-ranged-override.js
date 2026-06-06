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
                '  node src/server/scripts/patch-dungeonblitz-firebrand-ranged-override.js [--verify] [--swf <path>] [--ffdec <path>]',
                '',
                'Patches the served DungeonBlitz SWF so FireBrand RangedOverride',
                'sets CombatState.var_1651 while the buff is active and clears it',
                'when the FireBrand buff expires.'
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

function exportClasses(ffdecPath, repoRoot, workRoot, swfPath) {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    for (const className of ['CombatState', 'Buff']) {
        runFfdec(repoRoot, ffdecPath, ['-selectclass', className, '-export', 'script', workRoot, swfPath]);
    }

    const paths = {
        combatState: path.join(workRoot, 'scripts', 'CombatState.as'),
        buff: path.join(workRoot, 'scripts', 'Buff.as')
    };
    for (const filePath of Object.values(paths)) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`FFDec export did not produce ${filePath}`);
        }
    }
    return paths;
}

function verifySources(combatStateSource, buffSource, swfPath) {
    if (!combatStateSource.includes('param1.var_2125 && param1.buffName.indexOf("FireBrand") == 0')) {
        throw new Error(`${path.basename(swfPath)} CombatState.AddBuff is missing the FireBrand RangedOverride hook.`);
    }
    if (!combatStateSource.includes('this.var_1651 = param1.var_2125;')) {
        throw new Error(`${path.basename(swfPath)} CombatState.AddBuff does not assign FireBrand RangedOverride to var_1651.`);
    }
    if (!buffSource.includes('this.type.var_2125 && this.type.buffName.indexOf("FireBrand") == 0')) {
        throw new Error(`${path.basename(swfPath)} Buff.method_258 is missing the FireBrand RangedOverride cleanup guard.`);
    }
    if (!buffSource.includes('this.var_4.combatState.var_1651 = null;')) {
        throw new Error(`${path.basename(swfPath)} Buff.method_258 does not clear FireBrand RangedOverride from var_1651.`);
    }
}

function patchCombatStateSource(source, swfPath) {
    if (source.includes('param1.var_2125 && param1.buffName.indexOf("FireBrand") == 0')) {
        return source;
    }

    const marker = [
        '         if(param1.var_611)',
        '         {',
        '            this.var_3.method_1138(class_14.powerTypesDict[param1.var_611],param1.var_1251);',
        '         }',
        '         var _loc10_:uint = param2.id;'
    ].join('\r\n');
    const replacement = [
        '         if(param1.var_611)',
        '         {',
        '            this.var_3.method_1138(class_14.powerTypesDict[param1.var_611],param1.var_1251);',
        '         }',
        '         if(param1.var_2125 && param1.buffName.indexOf("FireBrand") == 0)',
        '         {',
        '            this.var_1651 = param1.var_2125;',
        '         }',
        '         var _loc10_:uint = param2.id;'
    ].join('\r\n');

    if (!source.includes(marker)) {
        throw new Error(`${path.basename(swfPath)} has an unexpected CombatState.AddBuff layout.`);
    }

    return source.replace(marker, replacement);
}

function patchBuffSource(source, swfPath) {
    source = source
        .replace('               this.var_1070 = null.entID;', '               this.var_1070 = _loc3_.entID;')
        .replace('               this.var_1209 = null.var_342;', '               this.var_1209 = _loc3_.var_342;');

    if (source.includes('this.type.var_2125 && this.type.buffName.indexOf("FireBrand") == 0')) {
        return source;
    }

    const marker = [
        '            if(this.type.var_611)',
        '            {',
        '               this.var_4.method_993(class_14.powerTypesDict[this.type.var_611]);',
        '            }',
        '            if(this.type.buffName.indexOf("ShadowArmor") == 0)'
    ].join('\r\n');
    const replacement = [
        '            if(this.type.var_611)',
        '            {',
        '               this.var_4.method_993(class_14.powerTypesDict[this.type.var_611]);',
        '            }',
        '            if(this.type.var_2125 && this.type.buffName.indexOf("FireBrand") == 0 && this.var_4.combatState.var_1651 == this.type.var_2125)',
        '            {',
        '               this.var_4.combatState.var_1651 = null;',
        '            }',
        '            if(this.type.buffName.indexOf("ShadowArmor") == 0)'
    ].join('\r\n');

    if (!source.includes(marker)) {
        throw new Error(`${path.basename(swfPath)} has an unexpected Buff.method_258 layout.`);
    }

    return source.replace(marker, replacement);
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-firebrand-ranged-override',
        path.basename(swfPath, path.extname(swfPath))
    );
    const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
    const exported = exportClasses(ffdecPath, repoRoot, workRoot, swfPath);
    const originalCombatState = fs.readFileSync(exported.combatState, 'utf8');
    const originalBuff = fs.readFileSync(exported.buff, 'utf8');
    const patchedCombatState = patchCombatStateSource(originalCombatState, swfPath);
    const patchedBuff = patchBuffSource(originalBuff, swfPath);

    verifySources(patchedCombatState, patchedBuff, swfPath);

    if (patchedCombatState === originalCombatState && patchedBuff === originalBuff) {
        console.log(`SWF already contains FireBrand ranged override support: ${swfPath}`);
        return;
    }

    fs.writeFileSync(exported.combatState, patchedCombatState, 'utf8');
    fs.writeFileSync(exported.buff, patchedBuff, 'utf8');
    runFfdec(repoRoot, ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.join(workRoot, 'scripts')]);
    const backupPath = `${swfPath}.bak`;
    if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(swfPath, backupPath);
    }
    fs.copyFileSync(patchedSwfPath, swfPath);
    verifySwf(repoRoot, ffdecPath, swfPath);
    console.log(`Patched FireBrand ranged override support in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-firebrand-ranged-override-verify',
        path.basename(swfPath, path.extname(swfPath))
    );
    const exported = exportClasses(ffdecPath, repoRoot, workRoot, swfPath);
    verifySources(
        fs.readFileSync(exported.combatState, 'utf8'),
        fs.readFileSync(exported.buff, 'utf8'),
        swfPath
    );
    console.log(`Verified FireBrand ranged override support in ${swfPath}`);
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

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}

module.exports = {
    detectFfdec,
    patchCombatStateSource,
    patchBuffSource,
    resolveRepoRoot,
    verifySources,
    verifySwf
};
