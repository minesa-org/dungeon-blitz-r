import * as path from 'path';
import { strict as assert } from 'assert';
import { Config } from '../core/config';
import { DungeonEntryDisplay } from '../core/DungeonEntryDisplay';
import { GameData } from '../core/GameData';
import { LevelConfig } from '../core/LevelConfig';
import { NpcLoader } from '../data/NpcLoader';

function loadRuntimeData(): void {
    const dataDir = path.join(Config.DATA_DIR, 'data');
    if (!LevelConfig.has('TutorialDungeon')) {
        LevelConfig.load(dataDir);
    }
    if (Object.keys(GameData.ENTTYPES).length === 0) {
        GameData.load(dataDir);
    }
    if (NpcLoader.getRawNpcsForLevel('BT_Mission2').length === 0) {
        NpcLoader.load(dataDir);
    }
}

function readElements(momentParams: string): string {
    const token = momentParams
        .split(',')
        .find((item) => item.startsWith(DungeonEntryDisplay.MOMENT_PREFIX));
    assert(token, 'enemy element token should be present');
    return token.slice(DungeonEntryDisplay.MOMENT_PREFIX.length);
}

loadRuntimeData();

const normalParams = DungeonEntryDisplay.buildMomentParams('BT_Mission2', '');
assert.equal(normalParams, 'EnemyElements=Fire');

const existingMomentParams = DungeonEntryDisplay.buildMomentParams('BT_Mission2', 'Intro');
assert.equal(existingMomentParams, 'Intro,EnemyElements=Fire');
assert.equal(readElements(existingMomentParams), 'Fire');

const nonDungeonParams = DungeonEntryDisplay.buildMomentParams('CraftTown', 'Normal');
assert.equal(nonDungeonParams, '');

const unknownParams = DungeonEntryDisplay.buildMomentParams('TutorialDungeonHard', 'Hard');
assert.match(unknownParams, /^Hard,EnemyElements=/);

console.log('dungeon_entry_display_regression: ok');
