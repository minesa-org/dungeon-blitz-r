#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGET_SWF = path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf');
const PATCH_CLASSES = ['class_67'];

const KEYBIND_REPLACEMENTS = new Map(Object.entries({
    'Lost Connection': 'Baglanti Koptu',
    'Client Error': 'Istemci Hatasi',
    'Left': 'Sol',
    'Right': 'Sag',
    'Jump': 'Zipla',
    'Drop': 'Dus',
    'Wave': 'El Salla',
    'Dance': 'Dans',
    'Cheer': 'Tezahurat',
    'Map': 'Harita',
    'Talents': 'Yetenekler',
    'Social': 'Sosyal',
    'Inventory': 'Envanter',
    'Store': 'Magaza',
    'Door': 'Kapi',
    'Home': 'Ev',
    'Spellbook': 'Buyu Kitabi',
    'Reply': 'Yanitla',
    'Pet': 'Evcil',
    'Mount': 'Binek',
    'Party Chat': 'Grup Sohbeti',
    'Guild Chat': 'Lonca Sohbeti'
}));

function resolveRepoRoot() {
    return path.resolve(__dirname, '..', '..', '..');
}

function resolvePath(repoRoot, value) {
    return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function detectFfdec(repoRoot, preferred) {
    const candidates = [
        preferred && resolvePath(repoRoot, preferred),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec-cli.jar'),
        '/Applications/FFDec.app/Contents/Resources/ffdec.sh',
        '/Applications/FFDec.app/Contents/Resources/ffdec.jar',
        '/Applications/FFDec.app/Contents/Resources/ffdec-cli.jar'
    ].filter(Boolean);

    return candidates.find((candidate) => fs.existsSync(candidate)) || '';
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

function parseArgs(argv) {
    const args = {
        ffdec: '',
        swf: TARGET_SWF,
        verify: false
    };

    for (let index = 2; index < argv.length; index += 1) {
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
        throw new Error(`Unknown argument: ${arg}`);
    }

    return args;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchSource(source, filePath) {
    let patched = source;
    let updated = 0;
    const basename = path.basename(filePath);

    if (basename === 'class_67.as') {
        for (const [from, to] of [
            ['Lost Connection', 'Baglanti Koptu'],
            ['Client Error', 'Istemci Hatasi']
        ]) {
            const next = patched.replace(new RegExp(`MathUtil\\.method_2\\(([^,]+),"${escapeRegExp(from)}"\\)`, 'g'), `MathUtil.method_2($1,"${to}")`);
            if (next !== patched) {
                updated += 1;
                patched = next;
            }
        }
    }

    if (basename === 'Game.as') {
        for (const [from, to] of KEYBIND_REPLACEMENTS) {
            const next = patched.replace(new RegExp(`mKeybindManager\\.method_44\\("${escapeRegExp(from)}",`, 'g'), `mKeybindManager.method_44("${to}",`);
            if (next !== patched) {
                updated += 1;
                patched = next;
            }
        }

        for (const [from, to] of [
            ['"Must be level " +', '"Seviye " +'],
            ['+ " to upgrade"', '+ " gerekli"'],
            ['"Busy upgrading " +', '"Yukseliyor " +']
        ]) {
            const next = patched.split(from).join(to);
            if (next !== patched) {
                updated += 1;
                patched = next;
            }
        }
    }

    if (basename === 'class_101.as') {
        for (const [from, to] of [
            ['ShowBasicDescriptionTooltip("Dismiss","Pet","M","Dismisses your pet from the battle field"', 'ShowBasicDescriptionTooltip("Gonder","Evcil","M","Evcilini savas alanindan gonderir"'],
            ['ShowBasicDescriptionTooltip("Dismount","Mount","M","Hop off of your majestic mount"', 'ShowBasicDescriptionTooltip("In","Binek","M","Gorkemli bineginden in"'],
            ['MathUtil.method_2(_loc4_.am_Type,"Mount")', 'MathUtil.method_2(_loc4_.am_Type,"Binek")'],
            ['MathUtil.method_8(_loc8_.am_Type,"Mount",ScreenArmory.const_106)', 'MathUtil.method_8(_loc8_.am_Type,"Binek",ScreenArmory.const_106)']
        ]) {
            const next = patched.split(from).join(to);
            if (next !== patched) {
                updated += 1;
                patched = next;
            }
        }
    }

    return { patched, updated };
}

function hasPatchedTurkishUi(source) {
    return source.includes('Baglanti Koptu') || source.includes('Istemci Hatasi');
}

function listActionScriptFiles(root) {
    const out = [];
    const stack = [root];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.as')) {
                out.push(fullPath);
            }
        }
    }
    return out;
}

function patchSwf(repoRoot, ffdecPath, swfPath, verifyOnly) {
    const workRoot = path.join(repoRoot, 'build', verifyOnly ? 'ffdec-hardcoded-tr-ui-verify' : 'ffdec-hardcoded-tr-ui');
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });

    runFfdec(ffdecPath, ['-selectclass', PATCH_CLASSES.join(','), '-export', 'script', workRoot, swfPath]);
    const scriptsRoot = path.join(workRoot, 'scripts');
    const files = listActionScriptFiles(scriptsRoot);
    let replacements = 0;
    let alreadyPatched = false;

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        const result = patchSource(source, file);
        replacements += result.updated;
        alreadyPatched = alreadyPatched || hasPatchedTurkishUi(source) || hasPatchedTurkishUi(result.patched);
        if (!verifyOnly && result.patched !== source) {
            fs.writeFileSync(file, result.patched);
        }
    }

    if (verifyOnly) {
        if (replacements <= 0 && !alreadyPatched) {
            throw new Error('No hardcoded Turkish UI replacement targets or patched Turkish strings were found.');
        }
        console.log(`Verified hardcoded Turkish UI strings; pending replacement groups: ${replacements}`);
        return;
    }

    const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.hardcoded-tr-ui.swf`);
    runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, scriptsRoot]);
    fs.copyFileSync(patchedSwfPath, swfPath);
    console.log(`Patched hardcoded Turkish UI strings in ${swfPath}; replacement groups: ${replacements}`);
}

function main() {
    const repoRoot = resolveRepoRoot();
    const args = parseArgs(process.argv);
    const ffdecPath = detectFfdec(repoRoot, args.ffdec);
    if (!ffdecPath) {
        throw new Error('FFDec not found. Pass --ffdec or install JPEXS FFDec.');
    }

    patchSwf(repoRoot, ffdecPath, resolvePath(repoRoot, args.swf), args.verify);
}

main();
