import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseSwz } from '../scripts/swzPatchUtils';
import { verifyFlameseerImprovements } from '../scripts/patch_gameswz_flameseer_improvements';

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const xmlDir = path.join(repoRoot, 'src', 'client', 'content', 'xml');
const cbqDir = path.join(repoRoot, 'src', 'client', 'content', 'localhost', 'p', 'cbq');

function readLooseXml(): { powerXml: string; buffXml: string; powerModXml: string } {
    return {
        powerXml: fs.readFileSync(path.join(xmlDir, 'PlayerPowerTypes.xml'), 'utf8'),
        buffXml: fs.readFileSync(path.join(xmlDir, 'PlayerBuffTypes.xml'), 'utf8'),
        powerModXml: fs.readFileSync(path.join(xmlDir, 'PowerModTypes.xml'), 'utf8')
    };
}

function readSwzXml(swzPath: string): { powerXml: string; buffXml: string; powerModXml: string } {
    const ctx = parseSwz(swzPath);
    const powerXml = ctx.chunks.find((entry) => entry.xml.includes('<PlayerPowerTypes'))?.xml;
    const buffXml = ctx.chunks.find((entry) => entry.xml.includes('<PlayerBuffTypes'))?.xml;
    const powerModXml = ctx.chunks.find((entry) => entry.xml.includes('<PowerModTypes'))?.xml;

    assert.ok(powerXml, `${path.basename(swzPath)} should contain PlayerPowerTypes`);
    assert.ok(buffXml, `${path.basename(swzPath)} should contain PlayerBuffTypes`);
    assert.ok(powerModXml, `${path.basename(swzPath)} should contain PowerModTypes`);

    return { powerXml, buffXml, powerModXml };
}

function main(): void {
    const loose = readLooseXml();
    verifyFlameseerImprovements(loose.powerXml, loose.buffXml, loose.powerModXml);

    const swzPaths = ['Game.swz', 'Game.en.swz', 'Game.tr.swz']
        .map((file) => path.join(cbqDir, file))
        .filter(fs.existsSync);
    assert.ok(swzPaths.length > 0, 'expected at least one served Game SWZ');

    for (const swzPath of swzPaths) {
        const swz = readSwzXml(swzPath);
        verifyFlameseerImprovements(swz.powerXml, swz.buffXml, swz.powerModXml);
    }

    console.log('flameseer_improvements_regression: ok');
}

try {
    main();
} catch (error) {
    console.error('flameseer_improvements_regression: failed');
    console.error(error);
    process.exitCode = 1;
}
