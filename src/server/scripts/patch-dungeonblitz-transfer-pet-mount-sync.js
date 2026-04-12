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
            '  node src/server/scripts/patch-dungeonblitz-transfer-pet-mount-sync.js [--verify] [--swf <path>] [--ffdec <path>]',
            '',
            'Defaults:',
            '  patches the served DungeonBlitz SWF so transfer/login player data reapplies',
            '  the local player mount and active pet state without respawning the entity.'
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
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.sh'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'tools', 'ffdec_25.1.3', 'ffdec-cli.jar'),
        '/Applications/FFDec.app/Contents/Resources/ffdec.sh',
        '/Applications/FFDec.app/Contents/Resources/ffdec.jar',
        '/Applications/FFDec.app/Contents/Resources/ffdec-cli.jar',
        path.join(repoRoot, 'temp', 'jpexs_25_1_3', 'FFDec.app', 'Contents', 'Resources', 'ffdec.sh'),
        path.join(repoRoot, 'temp', 'jpexs_25_1_3', 'FFDec.app', 'Contents', 'Resources', 'ffdec.jar'),
        path.join(repoRoot, 'temp', 'jpexs_25_1_3', 'FFDec.app', 'Contents', 'Resources', 'ffdec-cli.jar')
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

function replaceBlock(source, candidates, replacement, label) {
    if (source.includes(replacement)) {
        return source;
    }

    for (const candidate of candidates) {
        if (candidate && source.includes(candidate)) {
            return source.replace(candidate, replacement);
        }
    }

    throw new Error(`Could not find patch marker: ${label}`);
}

function patchLinkUpdater(source) {
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const join = (lines) => lines.join(eol);

    let patched = source;

    const helperAnchor = join([
        '      private function method_1142(param1:Packet) : void',
        '      {',
        '         var _loc2_:uint = param1.method_4();',
        '         var _loc3_:uint = param1.method_6(class_20.const_297);',
        '         var _loc4_:Entity = this.var_1.GetEntFromID(_loc2_);',
        '         if(_loc4_)',
        '         {',
        '            _loc4_.method_525(_loc3_ ? class_14.var_464[_loc3_] : null);',
        '         }',
        '      }'
    ]);
    const helperAnchorDirectAssign = join([
        '      private function method_1142(param1:Packet) : void',
        '      {',
        '         var _loc2_:uint = param1.method_4();',
        '         var _loc3_:uint = param1.method_6(class_20.const_297);',
        '         var _loc4_:Entity = this.var_1.GetEntFromID(_loc2_);',
        '         if(_loc4_)',
        '         {',
        '            _loc4_.mEquipMount = class_14.var_464[_loc3_];',
        '         }',
        '      }'
    ]);
    const helperPatched = join([
        '      private function method_1829(param1:uint, param2:uint, param3:uint) : void',
        '      {',
        '         var _loc4_:Entity = this.var_1 ? this.var_1.clientEnt : null;',
        '         var _loc5_:class_20 = param1 ? class_14.var_464[param1] : null;',
        '         var _loc6_:class_87 = null;',
        '         if(Boolean(this.var_1) && Boolean(this.var_1.mEggPetInfo))',
        '         {',
        '            this.var_1.mEggPetInfo.SetActivePetData(null);',
        '            if(param2)',
        '            {',
        '               _loc6_ = this.var_1.mEggPetInfo.GetPetDataByIDIteration(param2,param3);',
        '            }',
        '            this.var_1.mEggPetInfo.SetActivePetData(_loc6_);',
        '         }',
        '         if(_loc4_)',
        '         {',
        '            _loc4_.method_525(_loc5_);',
        '            _loc4_.ChangePet(_loc6_);',
        '         }',
        '      }',
        '      ',
        '      private function method_1142(param1:Packet) : void',
        '      {',
        '         var _loc2_:uint = param1.method_4();',
        '         var _loc3_:uint = param1.method_6(class_20.const_297);',
        '         var _loc4_:Entity = this.var_1.GetEntFromID(_loc2_);',
        '         if(_loc4_)',
        '         {',
        '            _loc4_.method_525(_loc3_ ? class_14.var_464[_loc3_] : null);',
        '         }',
        '      }'
    ]);

    const loginRestoreOriginal = join([
        '         var _loc35_:uint = param1.method_4();',
        '         var _loc36_:uint = param1.method_4();',
        '         var _loc37_:uint = param1.method_4();',
        '         this.var_1.mEggPetInfo.method_588();'
    ]);
    const loginRestoreClearingPet = join([
        '         var _loc35_:uint = param1.method_4();',
        '         var _loc36_:uint = param1.method_4();',
        '         var _loc37_:uint = param1.method_4();',
        '         if(Boolean(_loc36_ ? this.var_1.mEggPetInfo.GetPetDataByIDIteration(_loc36_,_loc37_) : null))',
        '         {',
        '            this.var_1.clientEnt.ChangePet(null);',
        '            this.var_1.mEggPetInfo.SetActivePetData(null);',
        '         }',
        '         this.var_1.mEggPetInfo.method_588();'
    ]);
    const loginRestorePatched = join([
        '         var _loc35_:uint = param1.method_4();',
        '         var _loc36_:uint = param1.method_4();',
        '         var _loc37_:uint = param1.method_4();',
        '         this.method_1829(_loc35_,_loc36_,_loc37_);',
        '         this.var_1.mEggPetInfo.method_588();'
    ]);

    patched = replaceBlock(
        patched,
        [helperAnchor, helperAnchorDirectAssign],
        helperPatched,
        'LinkUpdater transfer restore helper insertion'
    );
    patched = replaceBlock(
        patched,
        [loginRestoreOriginal, loginRestoreClearingPet],
        loginRestorePatched,
        'LinkUpdater login transfer pet/mount restore hook'
    );

    return patched;
}

function verifyLinkUpdater(source, swfPath) {
    if (!source.includes('private function method_1829(param1:uint, param2:uint, param3:uint) : void')) {
        throw new Error(`${path.basename(swfPath)} is missing the transfer restore helper.`);
    }
    if (!source.includes('this.method_1829(_loc35_,_loc36_,_loc37_);')) {
        throw new Error(`${path.basename(swfPath)} is missing the transfer restore call.`);
    }
    if (!source.includes('_loc4_.ChangePet(_loc6_);')) {
        throw new Error(`${path.basename(swfPath)} is missing the local active pet restore.`);
    }
    if (!source.includes('_loc4_.method_525(_loc5_);')) {
        throw new Error(`${path.basename(swfPath)} is missing the local mount restore.`);
    }
    if (source.includes('_loc4_.mEquipMount = class_14.var_464[_loc3_];')) {
        throw new Error(`${path.basename(swfPath)} still contains the direct mount assignment path.`);
    }
    if (source.includes('this.var_1.clientEnt.ChangePet(null);')) {
        throw new Error(`${path.basename(swfPath)} still contains the stale active pet clear path.`);
    }
}

function exportScripts(ffdecPath, workRoot, swfPath) {
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(ffdecPath, ['-selectclass', 'LinkUpdater', '-export', 'script', workRoot, swfPath]);
    return path.join(workRoot, 'scripts', 'LinkUpdater.as');
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-dungeonblitz-transfer-pet-mount-sync',
        path.basename(swfPath, path.extname(swfPath))
    );
    const linkUpdaterPath = exportScripts(ffdecPath, workRoot, swfPath);
    const original = fs.readFileSync(linkUpdaterPath, 'utf8');
    const patched = patchLinkUpdater(original);

    if (patched === original) {
        verifyLinkUpdater(original, swfPath);
        return;
    }

    fs.writeFileSync(linkUpdaterPath, patched, 'utf8');
    const patchedSwfPath = path.join(path.dirname(swfPath), `${path.basename(swfPath, path.extname(swfPath))}.transfer-pet-mount-sync.swf`);
    runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(linkUpdaterPath)]);
    fs.copyFileSync(patchedSwfPath, swfPath);
    fs.rmSync(patchedSwfPath, { force: true });
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(
        repoRoot,
        'build',
        'ffdec-dungeonblitz-transfer-pet-mount-sync-verify',
        path.basename(swfPath, path.extname(swfPath))
    );
    const linkUpdaterPath = exportScripts(ffdecPath, workRoot, swfPath);
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
