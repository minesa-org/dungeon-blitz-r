#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
    const args = {
        ffdec: '',
        swf: path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf'),
        verify: false
    };

    for (let index = 2; index < argv.length; index++) {
        const arg = argv[index];
        if (arg === '--ffdec' || arg === '-f') {
            args.ffdec = argv[++index] || '';
            continue;
        }
        if (arg === '--swf' || arg === '-s') {
            args.swf = argv[++index] || '';
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
            '  node src/server/scripts/patch-dungeonblitz-superanim-crash-guard.js [--verify] [--swf <path>] [--ffdec <path>]',
            '',
            'Defaults:',
            '  patches Game.method_1325 in the served DungeonBlitz.swf',
            '  so Invalid BitmapData failures inside SuperAnimInstance.method_105 do not crash the render tick.'
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
    return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function detectFfdec(repoRoot, preferred) {
    const candidates = [];
    if (preferred) {
        candidates.push(resolvePath(repoRoot, preferred));
    }

    candidates.push(
        path.join(repoRoot, 'build', 'ffdec_24.0.1', 'ffdec-cli.exe'),
        path.join(repoRoot, 'build', 'ffdec_24.0.1', 'ffdec-cli.jar'),
        path.join(repoRoot, 'build', 'ffdec_24.0.1', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec-cli.jar')
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
        execFileSync('java', ['-jar', resolved, '-cli', ...args], { stdio: 'inherit' });
        return;
    }

    execFileSync(resolved, ['-cli', ...args], { stdio: 'inherit' });
}

function ensureCleanDir(dirPath) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    fs.mkdirSync(dirPath, { recursive: true });
}

function exportGamePcode(ffdecPath, workRoot, swfPath) {
    ensureCleanDir(workRoot);
    runFfdec(ffdecPath, ['-format', 'script:pcode', '-selectclass', 'Game', '-export', 'script', workRoot, swfPath]);
    const pcodePath = path.join(workRoot, 'scripts', 'Game.pcode');
    if (!fs.existsSync(pcodePath)) {
        throw new Error(`FFDec export did not produce ${pcodePath}`);
    }
    return pcodePath;
}

function patchPcode(source) {
    if (source.includes('catch(_loc5_:Error)')) {
        return source;
    }

    const localCountNeedle = 'localcount 5';
    if (!source.includes(localCountNeedle)) {
        throw new Error('Could not find method_1325 localcount marker.');
    }

    let patched = source.replace(localCountNeedle, 'localcount 6');

    const methodCallPattern = /(ofs008c:\r?\n\s*label\r?\n\s*getlocal2\r?\n\s*callproperty QName\(PackageNamespace\(""\),"method_105"\), 0\r?\n\s*getlocal 4\r?\n\s*dup\r?\n\s*iffalse ofs009c\r?\n\s*pop\r?\n\s*getlocal2\r?\n\s*convert_b\r?\n\s*ofs009c:\r?\n)/;
    if (!methodCallPattern.test(patched)) {
        throw new Error('Could not find method_1325 method_105 block.');
    }

    patched = patched.replace(
        methodCallPattern,
        [
            '$1',
            '                                                                                                                                                                                                                                                                                                                                                                                                               ofs00cf:',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        getlocal0',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        pushscope',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        newcatch 0',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        dup',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        setlocal 5',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        dup',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        pushscope',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        swap',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        setslot 1',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        popscope',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        kill 5',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        getlocal2',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        pushtrue',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        setproperty QName(PackageInternalNs(""),"m_bFinished")',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        pushtrue',
            '                                                                                                                                                                                                                                                                                                                                                                                                                        jump ofs00a1'
        ].join('\r\n')
    );

    const jumpNeedle = 'ofs00ce:\r\n                                                                                                                                                                                                                                                                                                                                                                                                                        jump ofs008c';
    if (!patched.includes(jumpNeedle)) {
        throw new Error('Could not find method_1325 loop jump marker.');
    }

    const tryNeedle = 'end ; code\r\n                                                                                                                                                                                                                                                                                                                                                                                                               end ; body';
    if (!patched.includes(tryNeedle)) {
        throw new Error('Could not find method_1325 try insertion marker.');
    }

    patched = patched.replace(
        tryNeedle,
        [
            'end ; code',
            '                                                                                                                                                                                                                                                                                                                                                                                                                  try from ofs008c to ofs009c target ofs00cf type QName(PackageNamespace(""),"Error") name QName(PackageNamespace(""),"error") end',
            '                                                                                                                                                                                                                                                                                                                                                                                                               end ; body'
        ].join('\r\n')
    );

    return patched;
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(repoRoot, 'build', 'ffdec-dungeonblitz-superanim-crash-guard');
    const pcodePath = exportGamePcode(ffdecPath, workRoot, swfPath);
    const original = fs.readFileSync(pcodePath, 'utf8');
    const patched = patchPcode(original);

    if (patched === original) {
        console.log('[superanim-crash-guard] Game already patched');
        return;
    }

    fs.writeFileSync(pcodePath, patched, 'utf8');
    const patchedSwfPath = path.join(workRoot, path.basename(swfPath));
    runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(pcodePath)]);
    fs.copyFileSync(patchedSwfPath, swfPath);
    console.log(`[superanim-crash-guard] patched ${path.relative(repoRoot, swfPath)}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(repoRoot, 'build', 'ffdec-dungeonblitz-superanim-crash-guard-verify');
    const pcodePath = exportGamePcode(ffdecPath, workRoot, swfPath);
    const source = fs.readFileSync(pcodePath, 'utf8');
    const requiredSnippets = [
        'localcount 6',
        'catch(_loc5_:Error)',
        'setproperty QName(PackageInternalNs(""),"m_bFinished")',
        'try from ofs008c to ofs009c target ofs00cf type QName(PackageNamespace(""),"Error")'
    ];

    for (const snippet of requiredSnippets) {
        if (!source.includes(snippet)) {
            throw new Error(`Verification failed: missing snippet "${snippet}" in ${pcodePath}`);
        }
    }

    console.log(`[superanim-crash-guard] verified ${path.relative(repoRoot, swfPath)}`);
}

function main() {
    const args = parseArgs(process.argv);
    const repoRoot = resolveRepoRoot();
    const ffdecPath = detectFfdec(repoRoot, args.ffdec);
    if (!ffdecPath) {
        throw new Error('FFDec not found. Pass --ffdec or restore the repo-bundled FFDec tool.');
    }

    const swfPath = resolvePath(repoRoot, args.swf);
    if (!fs.existsSync(swfPath)) {
        throw new Error(`SWF not found: ${swfPath}`);
    }

    if (args.verify) {
        verifySwf(repoRoot, ffdecPath, swfPath);
        return;
    }

    patchSwf(repoRoot, ffdecPath, swfPath);
}

try {
    main();
} catch (error) {
    console.error('[superanim-crash-guard] failed');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
}
