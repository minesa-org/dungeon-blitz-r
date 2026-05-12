const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CLASS_NAME = 'a_Room_CHM01RYagagaBoss';

function parseArgs(argv) {
  const args = {
    swf: path.join('src', 'client', 'content', 'localhost', 'p', 'cam', 'LevelsCH.swf'),
    ffdec: '',
    verify: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--swf' || arg === '--swf-path') {
      args.swf = argv[++index] || args.swf;
    } else if (arg === '--ffdec' || arg === '-f') {
      args.ffdec = argv[++index] || '';
    } else if (arg === '--verify' || arg === '--dry-run') {
      args.verify = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function usage() {
  console.log([
    'Usage:',
    '  node src/server/scripts/patch-levelsch-wither-ambush.js [--verify] [--swf <path>] [--ffdec <path>]',
    '',
    'Patches LevelsCH a_Room_CHM01RYagagaBoss so boss ambush waves still spawn',
    'when a health threshold is skipped by a fast boss kill or sparse phase tick.'
  ].join('\n'));
}

function resolveRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function resolvePath(repoRoot, maybeRelative) {
  return path.isAbsolute(maybeRelative) ? maybeRelative : path.join(repoRoot, maybeRelative);
}

function detectFfdec(repoRoot, preferred) {
  const candidates = [];
  if (preferred) {
    candidates.push(resolvePath(repoRoot, preferred));
  }

  candidates.push(
    path.join(repoRoot, 'build', 'ffdec', 'ffdec-cli.jar'),
    path.join(repoRoot, 'build', 'ffdec', 'ffdec.jar'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_25.0.0', 'ffdec-cli.jar'),
    path.join(repoRoot, 'build', 'tools', 'ffdec_25.0.0', 'ffdec.jar')
  );

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
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

function exportRoomScript(ffdecPath, workRoot, swfPath) {
  fs.rmSync(workRoot, { recursive: true, force: true });
  fs.mkdirSync(workRoot, { recursive: true });
  runFfdec(ffdecPath, ['-selectclass', CLASS_NAME, '-export', 'script', workRoot, swfPath]);

  const roomPath = path.join(workRoot, 'scripts', `${CLASS_NAME}.as`);
  if (!fs.existsSync(roomPath)) {
    throw new Error(`FFDec export did not produce ${roomPath}`);
  }

  return roomPath;
}

function findMethodRange(source, methodName) {
  const marker = `public function ${methodName}(`;
  const start = source.indexOf(marker);
  if (start === -1) {
    throw new Error(`Could not find method ${methodName}`);
  }

  const braceStart = source.indexOf('{', start);
  if (braceStart === -1) {
    throw new Error(`Could not find method body for ${methodName}`);
  }

  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const ch = source[index];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { start, end: index + 1 };
      }
    }
  }

  throw new Error(`Could not find end of method ${methodName}`);
}

function replaceMethod(source, methodName, replacement) {
  const range = findMethodRange(source, methodName);
  return `${source.slice(0, range.start)}${replacement}${source.slice(range.end)}`;
}

function replaceExact(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Could not find patch marker: ${label}`);
  }
  return source.replace(needle, replacement);
}

function normalizeBlock(block, eol) {
  return block.trim().replace(/\n/g, eol);
}

function patchRoomSource(source) {
  try {
    verifyRoomSource(source, 'current source');
    return source;
  } catch (_error) {
    // Continue into the source patch path below.
  }

  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let patched = source;

  if (!patched.includes('public var bWaveOneTriggered:Boolean;')) {
    patched = replaceExact(
      patched,
      `      public var am_Foreground:MovieClip;${eol}`,
      [
        '      public var am_Foreground:MovieClip;',
        '      ',
        '      public var bWaveOneTriggered:Boolean;',
        '      ',
        '      public var bWaveTwoTriggered:Boolean;',
        '      ',
        '      public var bWaveThreeTriggered:Boolean;',
        ''
      ].join(eol),
      'wave trigger state fields'
    );
  }

  patched = replaceMethod(
    patched,
    'PhaseFight',
    normalizeBlock(`
      public function PhaseFight(param1:a_GameHook) : void
      {
         var _loc2_:Number = this.am_Boss.Health();
         if(!this.bWaveOneTriggered && (this.am_Boss.AtHealth(0.9) || _loc2_ <= 0.9))
         {
            this.bWaveOneTriggered = true;
            param1.Ambush("am_WaveOne");
         }
         if(!this.bWaveTwoTriggered && (this.am_Boss.AtHealth(0.66) || _loc2_ <= 0.66))
         {
            if(!this.bWaveOneTriggered)
            {
               this.bWaveOneTriggered = true;
               param1.Ambush("am_WaveOne");
            }
            this.bWaveTwoTriggered = true;
            param1.Ambush("am_WaveTwo");
            this.am_WaveOne.am_Leader.Skit("Hee hee");
         }
         if(!this.bWaveThreeTriggered && (this.am_Boss.AtHealth(0.33) || _loc2_ <= 0.33))
         {
            if(!this.bWaveOneTriggered)
            {
               this.bWaveOneTriggered = true;
               param1.Ambush("am_WaveOne");
            }
            if(!this.bWaveTwoTriggered)
            {
               this.bWaveTwoTriggered = true;
               param1.Ambush("am_WaveTwo");
            }
            this.bWaveThreeTriggered = true;
            param1.Ambush("am_WaveThree");
            this.am_WaveThree.am_Leader.Skit("Get him|her");
         }
      }
    `, eol)
  );

  verifyRoomSource(patched, 'patched source');
  return patched;
}

function verifyRoomSource(source, label) {
  const required = [
    'public var bWaveOneTriggered:Boolean;',
    'public var bWaveTwoTriggered:Boolean;',
    'public var bWaveThreeTriggered:Boolean;',
    'var _loc2_:Number = this.am_Boss.Health();',
    '!this.bWaveOneTriggered && (this.am_Boss.AtHealth(0.9) || _loc2_ <= 0.9)',
    '!this.bWaveTwoTriggered && (this.am_Boss.AtHealth(0.66) || _loc2_ <= 0.66)',
    '!this.bWaveThreeTriggered && (this.am_Boss.AtHealth(0.33) || _loc2_ <= 0.33)',
    'param1.Ambush("am_WaveOne");',
    'param1.Ambush("am_WaveTwo");',
    'param1.Ambush("am_WaveThree");'
  ];

  for (const marker of required) {
    if (!source.includes(marker)) {
      throw new Error(`${label} is missing required marker: ${marker}`);
    }
  }
}

function patchSwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelsch-wither-ambush', path.basename(swfPath, path.extname(swfPath)));
  const patchedSwfPath = path.join(workRoot, `${path.basename(swfPath, path.extname(swfPath))}.patched.swf`);
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  const original = fs.readFileSync(roomPath, 'utf8');
  const patched = patchRoomSource(original);

  if (patched === original) {
    console.log(`SWF already contains the Wither ambush patch: ${swfPath}`);
    return;
  }

  fs.writeFileSync(roomPath, patched, 'utf8');
  runFfdec(ffdecPath, ['-importScript', swfPath, patchedSwfPath, path.dirname(roomPath)]);
  fs.copyFileSync(patchedSwfPath, swfPath);
  console.log(`Patched Wither ambush waves in ${swfPath}`);
}

function verifySwf(repoRoot, ffdecPath, swfPath) {
  const workRoot = path.join(repoRoot, 'build', 'ffdec-levelsch-wither-ambush-verify', path.basename(swfPath, path.extname(swfPath)));
  const roomPath = exportRoomScript(ffdecPath, workRoot, swfPath);
  verifyRoomSource(fs.readFileSync(roomPath, 'utf8'), swfPath);
  console.log(`Verified Wither ambush waves in ${swfPath}`);
}

function main() {
  const repoRoot = resolveRepoRoot();
  const args = parseArgs(process.argv);
  const swfPath = resolvePath(repoRoot, args.swf);
  const ffdecPath = detectFfdec(repoRoot, args.ffdec);

  if (!ffdecPath) {
    throw new Error('FFDec not found. Pass --ffdec or restore the repo-bundled FFDec tool.');
  }

  if (args.verify) {
    verifySwf(repoRoot, ffdecPath, swfPath);
    return;
  }

  patchSwf(repoRoot, ffdecPath, swfPath);
  verifySwf(repoRoot, ffdecPath, swfPath);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
