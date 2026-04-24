#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const TARGET_SWF = path.join('src', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf');
const VERIFY_MARKER = 'catch(err:Error)';

function resolveRepoRoot() {
    return path.resolve(__dirname, '..', '..', '..');
}

function detectFfdec(repoRoot) {
    const candidates = [
        path.join(repoRoot, 'build', 'ffdec_24.0.1', 'ffdec.jar'),
        path.join(repoRoot, 'build', 'ffdec', 'ffdec.jar')
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
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
    const repoRoot = resolveRepoRoot();
    const ffdecHome = ensureFfdecHome(repoRoot);
    execFileSync('java', [`-Duser.home=${ffdecHome}`, '-jar', ffdecPath, '-cli', ...args], {
        env: { ...process.env, HOME: ffdecHome },
        stdio: 'inherit'
    });
}

function replaceOnce(source, searchValue, replaceValue, label) {
    if (!source.includes(searchValue)) {
        throw new Error(`Failed to locate ${label}`);
    }
    return source.replace(searchValue, replaceValue);
}

function patchClass82(source) {
    if (source.includes(VERIFY_MARKER)) {
        return source;
    }

    let patched = source;
    patched = replaceOnce(
        patched,
        '                              _loc9_ = §§pop();\r\n' +
            '                              if(_loc8_ > 4095 || _loc9_ > 4095 || _loc8_ * _loc9_ > 16777215)\r\n' +
            '                              {\r\n' +
            '                                 _loc12_ = Math.min(1,4095 / Math.max(_loc8_,_loc9_));\r\n' +
            '                                 if(_loc8_ * _loc9_ > 16777215)\r\n' +
            '                                 {\r\n' +
            '                                    _loc12_ = Math.min(_loc12_,Math.sqrt(16777215 / (_loc8_ * _loc9_)));\r\n' +
            '                                 }\r\n' +
            '                                 _loc8_ = Math.max(1,uint(Math.floor(_loc8_ * _loc12_)));\r\n' +
            '                                 _loc9_ = Math.max(1,uint(Math.floor(_loc9_ * _loc12_)));\r\n' +
            '                              }\r\n' +
            '                              if(!_loc8_ || !_loc9_)\r\n' +
            '                              {\r\n' +
            '                                 return false;\r\n' +
            '                              }\r\n' +
            '                              _loc4_.x = _loc5_.x + _loc3_.x;\r\n',
        'class_82 dimension clamp'
    );

    patched = replaceOnce(
        patched,
        '                                          if(_loc17_ || param2)\r\n' +
            '                                          {\r\n' +
            '                                             _loc11_ = new BitmapData(_loc8_,_loc9_,true,0);\r\n' +
            '                                             this.var_1522 += _loc8_ * _loc9_;\r\n' +
            '                                             if(_loc10_)\r\n' +
            '                                             {\r\n' +
            '                                                this.var_745[_loc10_] = _loc11_;\r\n' +
            '                                             }\r\n' +
            '                                          }\r\n',
        '                                          if(_loc17_ || param2)\r\n' +
            '                                          {\r\n' +
            '                                             try\r\n' +
            '                                             {\r\n' +
            '                                                _loc11_ = new BitmapData(_loc8_,_loc9_,true,0);\r\n' +
            '                                             }\r\n' +
            '                                             catch(err:Error)\r\n' +
            '                                             {\r\n' +
            '                                                return false;\r\n' +
            '                                             }\r\n' +
            '                                             this.var_1522 += _loc8_ * _loc9_;\r\n' +
            '                                             if(_loc10_)\r\n' +
            '                                             {\r\n' +
            '                                                this.var_745[_loc10_] = _loc11_;\r\n' +
            '                                             }\r\n' +
            '                                          }\r\n',
        'class_82 bitmap try/catch'
    );

    return patched;
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(repoRoot, 'build', 'ffdec-dungeonblitz-fullscreen-bitmap-guard');
    const scriptsRoot = path.join(workRoot, 'scripts');
    const patchedSwfPath = path.join(workRoot, 'DungeonBlitz.patched.swf');

    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(ffdecPath, ['-selectclass', 'class_82', '-export', 'script', workRoot, swfPath]);

    const classPath = path.join(scriptsRoot, 'class_82.as');
    if (!fs.existsSync(classPath)) {
        throw new Error(`FFDec export did not produce ${classPath}`);
    }

    const original = fs.readFileSync(classPath, 'utf8');
    const patched = patchClass82(original);
    if (patched === original) {
        console.log('DungeonBlitz.swf already contains the fullscreen bitmap guard patch.');
        return;
    }

    fs.writeFileSync(classPath, patched, 'utf8');
    runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, scriptsRoot]);
    fs.copyFileSync(patchedSwfPath, swfPath);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
    const workRoot = path.join(repoRoot, 'build', 'ffdec-dungeonblitz-fullscreen-bitmap-guard-verify');
    fs.rmSync(workRoot, { recursive: true, force: true });
    fs.mkdirSync(workRoot, { recursive: true });
    runFfdec(ffdecPath, ['-selectclass', 'class_82', '-export', 'script', workRoot, swfPath]);
    const classPath = path.join(workRoot, 'scripts', 'class_82.as');
    const source = fs.readFileSync(classPath, 'utf8');

    if (!source.includes('if(_loc8_ > 4095 || _loc9_ > 4095 || _loc8_ * _loc9_ > 16777215)')) {
        throw new Error('Patched class_82.as is missing the fullscreen bitmap clamp.');
    }
    if (!source.includes('catch(err:Error)')) {
        throw new Error('Patched class_82.as is missing the BitmapData try/catch guard.');
    }
}

function main() {
    const repoRoot = resolveRepoRoot();
    const ffdecPath = detectFfdec(repoRoot);
    if (!ffdecPath) {
        throw new Error('FFDec not found.');
    }

    const swfPath = path.join(repoRoot, TARGET_SWF);
    if (!fs.existsSync(swfPath)) {
        throw new Error(`SWF not found: ${swfPath}`);
    }

    patchSwf(repoRoot, ffdecPath, swfPath);
    verifySwf(repoRoot, ffdecPath, swfPath);
    console.log(`[patch-dungeonblitz-fullscreen-bitmap-guard] Patched ${swfPath}`);
}

try {
    main();
} catch (error) {
    console.error(`[patch-dungeonblitz-fullscreen-bitmap-guard] ${error.message}`);
    process.exitCode = 1;
}
