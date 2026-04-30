import { strict as assert } from 'assert';
import * as path from 'path';
import { LevelConfig } from '../core/LevelConfig';
import { PresenceService } from '../core/PresenceService';
import { MissionLoader } from '../data/MissionLoader';
import { MasterClassID } from '../core/Enums';

function ensureDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!LevelConfig.has('TutorialDungeon')) {
        LevelConfig.load(dataDir);
    }
    if (!MissionLoader.getMissionDef(3)) {
        MissionLoader.load(dataDir);
    }
}

function createFakeClient(
    currentLevel: string,
    characterOverrides: Partial<Record<string, unknown>> = {},
    playerSpawned: boolean = true
): Record<string, unknown> {
    return {
        currentLevel,
        worldEnteredAt: Date.now(),
        playerSpawned,
        character: {
            name: 'Azyraven',
            class: 'mage',
            level: 7,
            MasterClass: 0,
            ...characterOverrides
        }
    };
}

function testTutorialDungeonUsesMissionDisplayNameAndStatus(): void {
    const snapshot = (PresenceService as any).toSnapshot(
        createFakeClient('TutorialDungeon', {
            MasterClass: MasterClassID.Frostwarden,
            level: 12
        })
    );

    assert.ok(snapshot, 'presence snapshot should resolve for spawned tutorial dungeon clients');
    assert.equal(snapshot.levelName, 'Goblin Kidnappers');
    assert.equal(snapshot.details, 'Goblin Kidnappers');
    assert.equal(snapshot.state, 'In dungeon');
}

function testHomePresenceUsesHomeLabelAndStatus(): void {
    const snapshot = (PresenceService as any).toSnapshot(
        createFakeClient('CraftTownTutorial')
    );

    assert.ok(snapshot, 'presence snapshot should resolve for home tutorial clients');
    assert.equal(snapshot.levelName, 'Home');
    assert.equal(snapshot.details, 'Home');
    assert.equal(snapshot.state, 'In game');
}

function testCemeteryHillPresenceUsesCemeteryImage(): void {
    const snapshot = (PresenceService as any).toSnapshot(
        createFakeClient('CemeteryHill')
    );

    assert.ok(snapshot, 'presence snapshot should resolve for Cemetery Hill clients');
    assert.equal(snapshot.levelName, 'Cemetery Hill');
    assert.equal(snapshot.areaKey, 'cemeteryhill');
}

function testCemeteryHillHardPresenceUsesCemeteryImage(): void {
    const snapshot = (PresenceService as any).toSnapshot(
        createFakeClient('CemeteryHillHard')
    );

    assert.ok(snapshot, 'presence snapshot should resolve for hard Cemetery Hill clients');
    assert.equal(snapshot.levelName, 'Cemetery Hill (Hard)');
    assert.equal(snapshot.areaKey, 'cemeteryhill');
}

function main(): void {
    ensureDataLoaded();
    testTutorialDungeonUsesMissionDisplayNameAndStatus();
    testHomePresenceUsesHomeLabelAndStatus();
    testCemeteryHillPresenceUsesCemeteryImage();
    testCemeteryHillHardPresenceUsesCemeteryImage();
    console.log('presence_service_regression: ok');
}

try {
    main();
} catch (error) {
    console.error('presence_service_regression: failed');
    throw error;
}
