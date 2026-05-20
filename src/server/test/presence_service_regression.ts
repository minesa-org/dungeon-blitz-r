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
        playSessionStartedAt: Date.now(),
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

function testPresenceTimerUsesPlaySessionStartAcrossRegionChanges(): void {
    const playSessionStartedAt = Date.now() - 600_000;
    const worldEnteredAt = Date.now() - 10_000;
    const snapshot = (PresenceService as any).toSnapshot({
        ...createFakeClient('JadeCity'),
        playSessionStartedAt,
        worldEnteredAt
    });

    assert.ok(snapshot, 'presence snapshot should resolve for clients with a session start');
    assert.equal(snapshot.startedAtMs, playSessionStartedAt);
    assert.equal(snapshot.startedAt, new Date(playSessionStartedAt).toISOString());
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

function testJadeCityPresenceUsesValhavenName(): void {
    const snapshot = (PresenceService as any).toSnapshot(
        createFakeClient('JadeCity')
    );

    assert.ok(snapshot, 'presence snapshot should resolve for Valhaven clients');
    assert.equal(snapshot.levelName, 'Valhaven');
    assert.equal(snapshot.details, 'Valhaven');
    assert.equal(snapshot.areaKey, 'valhaven');
}

function testJadeCityHardPresenceUsesValhavenName(): void {
    const snapshot = (PresenceService as any).toSnapshot(
        createFakeClient('JadeCityHard')
    );

    assert.ok(snapshot, 'presence snapshot should resolve for hard Valhaven clients');
    assert.equal(snapshot.levelName, 'Valhaven (Hard)');
    assert.equal(snapshot.details, 'Valhaven (Hard)');
    assert.equal(snapshot.areaKey, 'valhaven');
}

function testJadeCityMissionFallbackUsesValhavenPrefix(): void {
    const snapshot = (PresenceService as any).toSnapshot(
        createFakeClient('JC_Mission99')
    );

    assert.ok(snapshot, 'presence snapshot should resolve for Valhaven mission fallback clients');
    assert.equal(snapshot.levelName, 'Valhaven Mission 99');
    assert.equal(snapshot.details, 'Valhaven Mission 99');
}

function main(): void {
    ensureDataLoaded();
    testTutorialDungeonUsesMissionDisplayNameAndStatus();
    testHomePresenceUsesHomeLabelAndStatus();
    testPresenceTimerUsesPlaySessionStartAcrossRegionChanges();
    testCemeteryHillPresenceUsesCemeteryImage();
    testCemeteryHillHardPresenceUsesCemeteryImage();
    testJadeCityPresenceUsesValhavenName();
    testJadeCityHardPresenceUsesValhavenName();
    testJadeCityMissionFallbackUsesValhavenPrefix();
    console.log('presence_service_regression: ok');
}

try {
    main();
} catch (error) {
    console.error('presence_service_regression: failed');
    throw error;
}
