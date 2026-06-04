#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGET_SWF = path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf');
const ABILITY_BOOK_CLASS = 'class_45';
const TOOLTIP_CLASS = 'class_101';
const LINK_UPDATER_CLASS = 'LinkUpdater';
const ABILITY_BOOK_MARKER = 'param2.className.toLowerCase() != this.var_1.clientEnt.mMasterClass';
const CATEGORY_FILTER_MARKER = 'param1 != _loc7_.mMasterClass';
const TOOLTIP_MARKER = 'param3.className.toLowerCase() != param1.mMasterClass';
const LINK_UPDATER_HOTBAR_MARKER = 'mAbilityBook.mHotbarList[1] = class_14.var_478[10]';

function parseArgs(argv) {
    const args = {
        ffdec: '',
        swf: TARGET_SWF,
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
            console.log([
                'Usage:',
                '  node src/server/scripts/patch-dungeonblitz-ability-discipline-gate.js [--verify] [--swf <path>] [--ffdec <path>]',
                '',
                'Patches DungeonBlitz.swf so all trained same-base-class',
                'discipline skills are displayed and can be equipped, and',
                'discipline changes do not locally reset the Mage hotbar.'
            ].join('\n'));
            process.exit(0);
        }

        throw new Error(`Unknown argument: ${arg}`);
    }

    return args;
}

function repoRoot() {
    return path.resolve(__dirname, '..', '..', '..');
}

function resolvePath(root, value) {
    if (!value) {
        return '';
    }
    return path.isAbsolute(value) ? value : path.join(root, value);
}

function detectFfdec(root, preferred) {
    const candidates = [];
    if (preferred) {
        candidates.push(resolvePath(root, preferred));
    }
    candidates.push(
        '/Applications/FFDec.app/Contents/Resources/ffdec.sh',
        '/Applications/FFDec.app/Contents/Resources/ffdec.jar',
        path.join(root, 'build', 'tools', 'ffdec_25.0.0', 'ffdec-cli.exe'),
        path.join(root, 'build', 'tools', 'ffdec_25.0.0', 'ffdec-cli.jar'),
        path.join(root, 'build', 'tools', 'ffdec_25.0.0', 'ffdec.jar'),
        path.join(root, 'build', 'tools', 'ffdec_25.0.0', 'ffdec.sh'),
        path.join(root, 'build', 'tools', 'ffdec_25.1.3', 'ffdec-cli.exe'),
        path.join(root, 'build', 'tools', 'ffdec_25.1.3', 'ffdec-cli.jar'),
        path.join(root, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.jar'),
        path.join(root, 'build', 'tools', 'ffdec_25.1.3', 'ffdec.sh'),
        path.join(root, 'build', 'ffdec', 'ffdec.sh'),
        path.join(root, 'build', 'ffdec', 'ffdec.jar'),
        path.join(root, 'build', 'ffdec_24.0.1', 'ffdec-cli.exe'),
        path.join(root, 'build', 'ffdec_24.0.1', 'ffdec-cli.jar')
    );

    for (const candidate of candidates) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error('Could not find FFDec. Pass --ffdec <path>.');
}

function ffdecHome(root) {
    const home = path.join(root, 'build', 'ffdec-home');
    fs.mkdirSync(path.join(home, 'Library', 'Application Support', 'FFDec', 'logs'), { recursive: true });
    fs.mkdirSync(path.join(home, 'JPEXS', 'FFDec', 'logs'), { recursive: true });
    fs.mkdirSync(path.join(home, 'LocalAppData'), { recursive: true });
    return home;
}

function runFfdec(root, ffdec, args) {
    const home = ffdecHome(root);
    const env = {
        ...process.env,
        APPDATA: home,
        HOME: home,
        LOCALAPPDATA: path.join(home, 'LocalAppData'),
        USERPROFILE: home
    };
    if (ffdec.toLowerCase().endsWith('.jar')) {
        execFileSync('java', [`-Duser.home=${home}`, '-jar', ffdec, '-cli', ...args], {
            stdio: 'inherit',
            env
        });
        return;
    }

    execFileSync(ffdec, ['-cli', ...args], {
        stdio: 'inherit',
        env
    });
}

function exportClass(root, ffdec, swfPath, outDir, className, format = 'script:as') {
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    runFfdec(root, ffdec, ['-format', format, '-selectclass', className, '-export', 'script', outDir, swfPath]);
    const extension = format === 'script:pcode' ? 'pcode' : 'as';
    const classPath = path.join(outDir, 'scripts', `${className}.${extension}`);
    if (!fs.existsSync(classPath)) {
        throw new Error(`FFDec did not export ${classPath}`);
    }
    return classPath;
}

function patchAbilityBookSource(source) {
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    let patched = source;

    if (patched.includes(ABILITY_BOOK_MARKER)) {
        const gateBlock = [
            '         if(Boolean(this.var_1.clientEnt) && Boolean(this.var_1.clientEnt.entType) && param2.className.toLowerCase() != this.var_1.clientEnt.mMasterClass && param2.className != this.var_1.clientEnt.entType.className)',
            '         {',
            '            return false;',
            '         }',
        ].join(eol);
        if (!patched.includes(gateBlock)) {
            throw new Error('Could not find SetAbilities discipline gate block.');
        }
        patched = patched.replace(gateBlock + eol, '');
    }

    if (patched.includes(CATEGORY_FILTER_MARKER)) {
        const filterBlock = [
            '         var _loc7_:Entity = this.var_1.clientEnt;',
            '         param1 = param1 ? param1.toLowerCase() : "";',
            '         var _loc5_:Vector.<class_10> = new Vector.<class_10>();',
            '         if(_loc7_ && _loc7_.entType && param1 != _loc7_.entType.className.toLowerCase() && param1 != _loc7_.mMasterClass)',
            '         {',
            '            return _loc5_;',
            '         }'
        ].join(eol);
        const openBlock = [
            '         param1 = param1 ? param1.toLowerCase() : "";',
            '         var _loc5_:Vector.<class_10> = new Vector.<class_10>();'
        ].join(eol);
        if (!patched.includes(filterBlock)) {
            throw new Error('Could not find getSpellsByCategory discipline filter block.');
        }
        patched = patched.replace(filterBlock, openBlock);
    }

    return patched;
}

function patchTooltipSource(source) {
    let patched = source;
    const sourceEol = patched.includes('\r\n') ? '\r\n' : '\n';

    if (!patched.includes('var _loc19_:PowerType = null;')) {
        patched = patched.replace(
            '         var _loc18_:String = null;\n',
            '         var _loc18_:String = null;\n         var _loc19_:PowerType = null;\n'
        ).replace(
            '         var _loc18_:String = null;\r\n',
            '         var _loc18_:String = null;\r\n         var _loc19_:PowerType = null;\r\n'
        );
    }

    patched = patched
        .replace(
            '         if(!(param4.procRune2 ? class_14.powerTypesDict[param4.procRune2] : null))',
            [
                '         _loc19_ = param4.procRune2 ? class_14.powerTypesDict[param4.procRune2] : null;',
                '         if(!_loc19_)'
            ].join(sourceEol)
        )
        .replace('MathUtil.method_2(param3.am_ProcTypeName2,null.method_349(param1));', 'MathUtil.method_2(param3.am_ProcTypeName2,_loc19_.method_349(param1));')
        .replace('param2.method_12(_loc12_.am_RuneHolder,null.runeIcon);', 'param2.method_12(_loc12_.am_RuneHolder,_loc19_.runeIcon);');

    if (patched.includes(TOOLTIP_MARKER)) {
        const gateBlock = [
            '            if(param3.className.toLowerCase() != param1.mMasterClass && param3.className != param1.entType.className)',
            '            {',
            '               MathUtil.method_2(_loc6_.am_UseCase,"Requires " + Game.method_226(param3.className) + " discipline");',
            '            }',
            '            else if(!param3.var_223)'
        ].join(sourceEol);
        if (!patched.includes(gateBlock)) {
            throw new Error('Could not find ShowSpellbookTooltip discipline gate block.');
        }
        return patched.replace(gateBlock, '            if(!param3.var_223)');
    }

    const eol = patched.includes('\r\n') ? '\r\n' : '\n';
    if (!patched.includes([
        '            if(!param3.var_223)',
        '            {',
        '               if(_loc10_)'
    ].join(eol))) {
        throw new Error('Could not verify ShowSpellbookTooltip equip-use block.');
    }
    return patched;
}

function patchLinkUpdaterSource(source) {
    if (!source.includes(LINK_UPDATER_HOTBAR_MARKER)) {
        return source;
    }

    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const hotbarResetBlock = [
        '                  if(_loc5_.entType && _loc5_.entType.className.toLowerCase() == "mage" && class_14.var_478[10] && class_14.var_478[14] && class_14.var_478[17])',
        '                  {',
        '                     this.var_1.mAbilityBook.mHotbarList[1] = class_14.var_478[10];',
        '                     this.var_1.mAbilityBook.mHotbarList[2] = class_14.var_478[14];',
        '                     this.var_1.mAbilityBook.mHotbarList[3] = class_14.var_478[17];',
        '                     this.var_1.screenSpellbook.Refresh();',
        '                     this.var_1.screenHudTop.Refresh();',
        '                  }'
    ].join(eol);

    if (!source.includes(hotbarResetBlock)) {
        throw new Error('Could not find LinkUpdater.method_1172 hotbar reset block.');
    }
    return source.replace(hotbarResetBlock + eol, '');
}

function verifyAbilityBookSource(source, label) {
    if (source.includes(ABILITY_BOOK_MARKER)) {
        throw new Error(`${label}: still has discipline gate in ${ABILITY_BOOK_CLASS}.SetAbilities`);
    }
    if (source.includes(CATEGORY_FILTER_MARKER)) {
        throw new Error(`${label}: still has category filter in ${ABILITY_BOOK_CLASS}.getSpellsByCategory`);
    }
}

function verifyTooltipSource(source, label) {
    if (source.includes(TOOLTIP_MARKER)) {
        throw new Error(`${label}: still has discipline requirement in ${TOOLTIP_CLASS}.ShowSpellbookTooltip`);
    }
}

function verifyLinkUpdaterSource(source, label) {
    if (source.includes(LINK_UPDATER_HOTBAR_MARKER)) {
        throw new Error(`${label}: still has Mage hotbar reset in ${LINK_UPDATER_CLASS}.method_1172`);
    }
}

function ensureBackup(swfPath) {
    const backup = `${swfPath}.bak`;
    if (!fs.existsSync(backup)) {
        fs.copyFileSync(swfPath, backup);
    }
}

function main() {
    const root = repoRoot();
    const args = parseArgs(process.argv);
    const swfPath = resolvePath(root, args.swf);
    const ffdec = detectFfdec(root, args.ffdec);
    const workRoot = path.join(root, 'build', 'ffdec-ability-discipline-gate');
    const abilityExportRoot = path.join(workRoot, 'export-ability-book');
    const tooltipExportRoot = path.join(workRoot, 'export-tooltip');
    const linkExportRoot = path.join(workRoot, 'export-link-updater');

    const abilityClassPath = exportClass(root, ffdec, swfPath, abilityExportRoot, ABILITY_BOOK_CLASS);
    const tooltipClassPath = exportClass(root, ffdec, swfPath, tooltipExportRoot, TOOLTIP_CLASS);
    const linkClassPath = exportClass(root, ffdec, swfPath, linkExportRoot, LINK_UPDATER_CLASS);
    const abilitySource = fs.readFileSync(abilityClassPath, 'utf8');
    const tooltipSource = fs.readFileSync(tooltipClassPath, 'utf8');
    const linkSource = fs.readFileSync(linkClassPath, 'utf8');
    const patchedAbilitySource = patchAbilityBookSource(abilitySource);
    const patchedTooltipSource = patchTooltipSource(tooltipSource);
    const patchedLinkSource = patchLinkUpdaterSource(linkSource);

    if (args.verify) {
        verifyAbilityBookSource(abilitySource, swfPath);
        verifyTooltipSource(tooltipSource, swfPath);
        verifyLinkUpdaterSource(linkSource, swfPath);
        console.log(`${swfPath}: already patched (all discipline skills enabled).`);
        return;
    }
    if (patchedAbilitySource === abilitySource && patchedTooltipSource === tooltipSource && patchedLinkSource === linkSource) {
        verifyAbilityBookSource(abilitySource, swfPath);
        verifyTooltipSource(tooltipSource, swfPath);
        verifyLinkUpdaterSource(linkSource, swfPath);
        console.log(`${swfPath}: already patched (all discipline skills enabled).`);
        return;
    }

    const importRoot = path.join(workRoot, 'import');
    const importScriptsRoot = path.join(importRoot, 'scripts');
    fs.rmSync(importRoot, { recursive: true, force: true });
    fs.mkdirSync(importScriptsRoot, { recursive: true });
    fs.writeFileSync(path.join(importScriptsRoot, `${ABILITY_BOOK_CLASS}.as`), patchedAbilitySource);
    fs.writeFileSync(path.join(importScriptsRoot, `${TOOLTIP_CLASS}.as`), patchedTooltipSource);
    fs.writeFileSync(path.join(importScriptsRoot, `${LINK_UPDATER_CLASS}.as`), patchedLinkSource);
    const outSwf = path.join(workRoot, 'DungeonBlitz.swf');
    runFfdec(root, ffdec, ['-importScript', swfPath, outSwf, importScriptsRoot]);

    const verifyAbilityRoot = path.join(workRoot, 'verify-ability-book');
    const verifyTooltipRoot = path.join(workRoot, 'verify-tooltip');
    const verifyLinkRoot = path.join(workRoot, 'verify-link-updater');
    const verifyAbilityPath = exportClass(root, ffdec, outSwf, verifyAbilityRoot, ABILITY_BOOK_CLASS);
    const verifyTooltipPath = exportClass(root, ffdec, outSwf, verifyTooltipRoot, TOOLTIP_CLASS);
    const verifyLinkPath = exportClass(root, ffdec, outSwf, verifyLinkRoot, LINK_UPDATER_CLASS);
    verifyAbilityBookSource(fs.readFileSync(verifyAbilityPath, 'utf8'), outSwf);
    verifyTooltipSource(fs.readFileSync(verifyTooltipPath, 'utf8'), outSwf);
    verifyLinkUpdaterSource(fs.readFileSync(verifyLinkPath, 'utf8'), outSwf);

    ensureBackup(swfPath);
    fs.copyFileSync(outSwf, swfPath);
    console.log(`${swfPath}: patched all discipline skills enabled.`);
}

main();
