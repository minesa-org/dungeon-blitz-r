import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const entTypesPath = path.join(root, 'src/client/content/xml/EntTypes.xml');
const xml = fs.readFileSync(entTypesPath, 'utf8');

function getEntTypeBlock(entName: string): string {
    const pattern = new RegExp(`<EntType EntName="${entName}"[\\s\\S]*?<\\/EntType>`);
    const match = xml.match(pattern);
    assert.ok(match, `${entName} block must exist`);
    return match[0];
}

function main(): void {
    for (const entName of [
        'FireBombSlow',
        'FireBomb',
        'FireBombSlowHard',
        'FireBombHard',
        'FireBomb2',
        'FireBomb2Hard'
    ]) {
        const block = getEntTypeBlock(entName);
        assert.match(block, /<CustomArt3>Animation_Demonhead\.swf\/Flame<\/CustomArt3>/);
        assert.doesNotMatch(block, /Animation_Demonhead\.swf\/FireBall/);
    }
}

try {
    main();
} catch (error) {
    console.error('firebomb_art_regression: failed');
    console.error(error);
    process.exit(1);
}
