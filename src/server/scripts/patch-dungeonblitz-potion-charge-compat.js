#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGETS = [
    path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf')
];

const PATCH_SOURCE = path.join('src', 'client', 'ffdec-patches', 'DungeonBlitz', 'scripts');
const PATCH_CLASS = 'class_103';
const VERIFY_MARKER = 'private function method_2084(param1:uint) : uint';

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
            '  node src/server/scripts/patch-dungeonblitz-potion-charge-compat.js [--verify] [--swf <path>] [--ffdec <path>]',
            '',
            'Defaults:',
            '  patches the served DungeonBlitz SWF so potion HUD percentages stay correct',
            '  when the server sends potion inventory as bottle counts instead of 5000-charge units.'
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
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec-cli.jar'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.sh'),
        '/Applications/FFDec.app/Contents/Resources/ffdec.jar',
        '/Applications/FFDec.app/Contents/Resources/ffdec-cli.jar',
        '/Applications/FFDec.app/Contents/Resources/ffdec.sh'
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

function runFfdec(ffdecPath, args) {
    const resolved = path.resolve(ffdecPath);
    const basename = path.basename(resolved).toLowerCase();
    const repoRoot = resolveRepoRoot();
    const ffdecHome = ensureFfdecHome(repoRoot);
    const env = {
        ...process.env,
        HOME: ffdecHome
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

function exportPatchedClass(ffdecPath, workRoot, swfPath) {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(ffdecPath, ['-selectclass', PATCH_CLASS, '-export', 'script', workRoot, swfPath]);

    const classPath = path.join(workRoot, 'scripts', `${PATCH_CLASS}.as`);
    if (!fs.existsSync(classPath)) {
        throw new Error(`FFDec export did not produce ${classPath}`);
    }

    return classPath;
}

function verifyPatchedClass(source, swfPath) {
    const normalized = source.replace(/\r\n/g, '\n');
    if (!normalized.includes(VERIFY_MARKER)) {
        throw new Error(`${path.basename(swfPath)} is missing the potion charge compatibility helper.`);
    }
    if (!normalized.includes('param1 < class_3.const_133 && param1 <= 100')) {
        throw new Error(`${path.basename(swfPath)} is missing the legacy potion stack heuristic.`);
    }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const scriptsRoot = path.join(repoRoot, PATCH_SOURCE);
    const patchClassPath = path.join(scriptsRoot, `${PATCH_CLASS}.as`);
    if (!fs.existsSync(patchClassPath)) {
        throw new Error(`Missing patch source: ${patchClassPath}`);
    }

    const workRoot = path.join(repoRoot, 'build', 'ffdec-dungeonblitz-potion-charge-compat');
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });

    const patchedSwfPath = path.join(workRoot, path.basename(swfPath));
    runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, scriptsRoot]);
    fs.copyFileSync(patchedSwfPath, swfPath);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(repoRoot, 'build', 'ffdec-dungeonblitz-potion-charge-compat-verify');
    const classPath = exportPatchedClass(ffdecPath, workRoot, swfPath);
    const source = fs.readFileSync(classPath, 'utf8');
    verifyPatchedClass(source, swfPath);
}

function resolveTargets(repoRoot, requestedSwfs) {
    const rawTargets = requestedSwfs.length > 0 ? requestedSwfs : TARGETS;
    return rawTargets.map((target) => resolvePath(repoRoot, target));
}

function main() {
    const args = parseArgs(process.argv);
    const repoRoot = resolveRepoRoot();
    const ffdecPath = detectFfdec(repoRoot, args.ffdec);

    if (!ffdecPath) {
        throw new Error('FFDec not found. Pass --ffdec or restore the repo-bundled FFDec app.');
    }

    const swfTargets = resolveTargets(repoRoot, args.swfs);
    for (const swfPath of swfTargets) {
        if (!fs.existsSync(swfPath)) {
            throw new Error(`SWF not found: ${swfPath}`);
        }

        if (args.verify) {
            verifySwf(repoRoot, ffdecPath, swfPath);
            console.log(`[patch-dungeonblitz-potion-charge-compat] Verified ${swfPath}`);
            continue;
        }

        patchSwf(repoRoot, ffdecPath, swfPath);
        verifySwf(repoRoot, ffdecPath, swfPath);
        console.log(`[patch-dungeonblitz-potion-charge-compat] Patched ${swfPath}`);
    }
}

try {
    main();
} catch (error) {
    console.error(`[patch-dungeonblitz-potion-charge-compat] ${error.message}`);
    process.exitCode = 1;
}
