import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { PetConfig } from '../core/PetConfig';
import { parseSwz } from '../scripts/swzPatchUtils';

const ROOT = path.resolve(__dirname, '..', '..', '..');
const MAX_HOME_TIMER_SECONDS = 4 * 24 * 60 * 60;

function assertXmlUpgradeTimesCapped(xml: string, label: string): void {
    let seen = 0;
    for (const match of xml.matchAll(/<UpgradeTime>(\d+)<\/UpgradeTime>/g)) {
        seen += 1;
        const value = Number(match[1] ?? 0);
        assert.ok(
            value <= MAX_HOME_TIMER_SECONDS,
            `${label} UpgradeTime ${value} should not exceed ${MAX_HOME_TIMER_SECONDS}`
        );
    }
    assert.ok(seen > 0, `${label} should contain UpgradeTime values`);
}

function assertJsonUpgradeTimesCapped(filePath: string): void {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Array<Record<string, unknown>>;
    assert.ok(data.length > 0, `${path.basename(filePath)} should contain data`);
    for (const entry of data) {
        const value = Number(entry.UpgradeTime ?? 0);
        assert.ok(
            value <= MAX_HOME_TIMER_SECONDS,
            `${path.basename(filePath)} ${entry.AbilityName ?? entry.BuildingName ?? 'entry'} rank ${entry.Rank ?? '?'} UpgradeTime ${value} should not exceed ${MAX_HOME_TIMER_SECONDS}`
        );
    }
}

function assertLooseHomeTimersCapped(): void {
    const xmlDir = path.join(ROOT, 'src', 'client', 'content', 'xml');
    const dataDir = path.join(ROOT, 'src', 'server', 'data');

    for (const fileName of ['BuildingTypes.xml', 'AbilityTypes.xml']) {
        assertXmlUpgradeTimesCapped(
            fs.readFileSync(path.join(xmlDir, fileName), 'utf8'),
            fileName
        );
    }
    for (const fileName of ['BuildingTypes.json', 'AbilityTypes.json']) {
        assertJsonUpgradeTimesCapped(path.join(dataDir, fileName));
    }
}

function assertPackedGameTimersCapped(): void {
    const swzDir = path.join(ROOT, 'src', 'client', 'content', 'localhost', 'p', 'cbq');
    for (const fileName of ['Game.swz', 'Game.en.swz', 'Game.tr.swz']) {
        const chunks = parseSwz(path.join(swzDir, fileName)).chunks.filter((chunk) =>
            chunk.xml.includes('<BuildingTypes') || chunk.xml.includes('<AbilityTypes')
        );
        assert.equal(chunks.length, 2, `${fileName} should contain BuildingTypes and AbilityTypes`);
        for (const chunk of chunks) {
            assertXmlUpgradeTimesCapped(chunk.xml, `${fileName} chunk ${chunk.index}`);
        }
    }
}

function assertPetTimersCapped(): void {
    const eggDurations = Object.values(PetConfig.EGG_HATCH_TIMES).map(Number);
    assert.equal(Math.max(...eggDurations), MAX_HOME_TIMER_SECONDS, 'egg hatching should cap at four days');
    assert.equal(Math.max(...PetConfig.TRAINING_TIME), MAX_HOME_TIMER_SECONDS, 'pet training should cap at four days');
}

assertLooseHomeTimersCapped();
assertPackedGameTimersCapped();
assertPetTimersCapped();
console.log('home_time_reductions_regression: ok');
