import * as path from 'path';

const { detectFfdec, resolveRepoRoot, verifySwf } = require('../scripts/patch-dungeonblitz-firebrand-ranged-override.js');

const repoRoot = resolveRepoRoot();
const ffdecPath = detectFfdec(repoRoot, '');
if (!ffdecPath) {
    throw new Error('FFDec not found for FireBrand ranged override verification.');
}

const dungeonBlitzSwfPath = path.join(repoRoot, 'src/client/content/localhost/p/cbp/DungeonBlitz.swf');
verifySwf(repoRoot, ffdecPath, dungeonBlitzSwfPath);

console.log('firebrand_ranged_override_regression: ok');
