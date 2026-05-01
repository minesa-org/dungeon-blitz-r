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
            '  node src/server/scripts/patch-dungeonblitz-add-buff-mod-loop.js [--verify] [--swf <path>] [--ffdec <path>]',
            '',
            'Defaults:',
            '  patches the served DungeonBlitz SWF so AddBuff packets with power-node',
            '  modifier values serialize each value once instead of looping forever.'
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

function patchLinkUpdater(source) {
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const join = (lines) => lines.join(eol);
    const patchedBlock = join([
        '            var _loc9_:int = 0;',
        '            while(_loc9_ < param7.length)',
        '            {',
        '               _loc8_.method_9(param7[_loc9_].powerNodeTypeID);',
        '               _loc8_.method_9(param7[_loc9_].modValue.length);',
        '               var _loc10_:int = 0;',
        '               while(_loc10_ < param7[_loc9_].modValue.length)',
        '               {',
        '                  _loc8_.method_309(param7[_loc9_].modValue[_loc10_]);',
        '                  _loc10_++;',
        '               }',
        '               _loc9_++;',
        '            }'
    ]);

    if (source.includes(patchedBlock)) {
        return source;
    }

    const originalBlock = join([
        '            var _loc9_:int = 0;',
        '            while(0 < param7.length)',
        '            {',
        '               _loc8_.method_9(param7[0].powerNodeTypeID);',
        '               _loc8_.method_9(param7[0].modValue.length);',
        '               var _loc10_:int = 0;',
        '               while(0 < param7[0].modValue.length)',
        '               {',
        '                  _loc8_.method_309(param7[0].modValue[0]);',
        '                  _loc10_++;',
        '               }',
        '               _loc9_++;',
        '            }'
    ]);

    if (!source.includes(originalBlock)) {
        throw new Error('Could not find LinkUpdater.method_1262 AddBuff modifier loop.');
    }

    return source.replace(originalBlock, patchedBlock);
}

function verifyLinkUpdater(source, swfPath) {
    const normalized = source.replace(/\r\n/g, '\n');
    if (!normalized.includes('while(_loc9_ < param7.length)')) {
        throw new Error(`${path.basename(swfPath)} is missing the indexed AddBuff modifier loop.`);
    }
    if (!normalized.includes('while(_loc10_ < param7[_loc9_].modValue.length)')) {
        throw new Error(`${path.basename(swfPath)} is missing the indexed AddBuff modifier value loop.`);
    }
    if (!normalized.includes('_loc8_.method_309(param7[_loc9_].modValue[_loc10_]);')) {
        throw new Error(`${path.basename(swfPath)} is missing indexed AddBuff modifier float serialization.`);
    }
    if (normalized.includes('while(0 < param7.length)') || normalized.includes('while(0 < param7[0].modValue.length)')) {
        throw new Error(`${path.basename(swfPath)} still contains the non-terminating AddBuff modifier loop.`);
    }
}

function exportLinkUpdater(ffdecPath, workRoot, swfPath) {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(ffdecPath, ['-selectclass', 'LinkUpdater', '-export', 'script', workRoot, swfPath]);

    const linkUpdaterPath = path.join(workRoot, 'scripts', 'LinkUpdater.as');
    if (!fs.existsSync(linkUpdaterPath)) {
        throw new Error(`FFDec export did not produce ${linkUpdaterPath}`);
    }

    return linkUpdaterPath;
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-dungeonblitz-add-buff-mod-loop',
        path.basename(swfPath, path.extname(swfPath))
    );
    const linkUpdaterPath = exportLinkUpdater(ffdecPath, workRoot, swfPath);
    const original = fs.readFileSync(linkUpdaterPath, 'utf8');
    const patched = patchLinkUpdater(original);

    if (patched === original) {
        verifyLinkUpdater(original, swfPath);
        return;
    }

    fs.writeFileSync(linkUpdaterPath, patched, 'utf8');
    const patchedSwfPath = path.join(workRoot, path.basename(swfPath));
    runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(linkUpdaterPath)]);
    fs.copyFileSync(patchedSwfPath, swfPath);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-dungeonblitz-add-buff-mod-loop-verify',
        path.basename(swfPath, path.extname(swfPath))
    );
    const linkUpdaterPath = exportLinkUpdater(ffdecPath, workRoot, swfPath);
    verifyLinkUpdater(fs.readFileSync(linkUpdaterPath, 'utf8'), swfPath);
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
            console.log(`[patch-dungeonblitz-add-buff-mod-loop] Verified ${swfPath}`);
            continue;
        }

        patchSwf(repoRoot, ffdecPath, swfPath);
        verifySwf(repoRoot, ffdecPath, swfPath);
        console.log(`[patch-dungeonblitz-add-buff-mod-loop] Patched ${swfPath}`);
    }
}

try {
    main();
} catch (error) {
    console.error(`[patch-dungeonblitz-add-buff-mod-loop] ${error.message}`);
    process.exitCode = 1;
}
