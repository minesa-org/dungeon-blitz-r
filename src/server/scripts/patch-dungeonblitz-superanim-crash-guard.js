#!/usr/bin/env node

const path = require('path');

function hasSwfArg(argv) {
    return argv.includes('--swf') || argv.includes('-s');
}

if (!hasSwfArg(process.argv)) {
    process.argv.push(
        '--swf',
        path.resolve(__dirname, '..', '..', 'client', 'content', 'localhost', 'p', 'cbp', 'DungeonBlitz.swf')
    );
}

require('../dist/scripts/patch-dungeonblitz-game-superanim-crash-guard.js');
