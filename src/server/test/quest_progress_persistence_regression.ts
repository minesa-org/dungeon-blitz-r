import { strict as assert } from 'assert';
import * as path from 'path';
import { LevelConfig } from '../core/LevelConfig';
import { Character } from '../database/Database';
import { JsonAdapter } from '../database/JsonAdapter';
import { MissionLoader } from '../data/MissionLoader';
import { LevelHandler } from '../handlers/LevelHandler';
import { MissionHandler } from '../handlers/MissionHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

type FakeClient = {
    userId: number;
    character: Character;
    characters: Character[];
    currentLevel: string;
    levelInstanceId: string;
    syncQuestProgress?: number;
    playerSpawned?: boolean;
    sentPackets?: Array<{ id: number; payload: Buffer }>;
    send?: (id: number, payload: Buffer) => void;
    sendBitBuffer?: (id: number, bb: BitBuffer) => void;
};

function createCharacter(): Character {
    return {
        name: 'Neodevil',
        class: 'Paladin',
        gender: 'male',
        level: 10,
        questTrackerState: 92,
        CurrentLevel: { name: 'CraftTown', x: 360, y: 1460 },
        PreviousLevel: { name: 'NewbieRoad', x: 1421, y: 826 }
    };
}

function createClient(): FakeClient {
    const character = createCharacter();
    return {
        userId: 6,
        character,
        characters: [character],
        currentLevel: 'CraftTown',
        levelInstanceId: ''
    };
}

function createQuestProgressPacket(progress: number): Buffer {
    const bb = new BitBuffer();
    bb.writeMethod4(progress);
    return bb.toBuffer();
}

function ensureLevelConfigLoaded(): void {
    if (!LevelConfig.isDungeonLevel('AC_Mission6')) {
        LevelConfig.load(path.resolve(__dirname, '../data'));
    }
    if (!MissionLoader.getMissionDef(187)) {
        MissionLoader.load(path.resolve(__dirname, '../data'));
    }
}

async function testQuestProgressUpdatePersistsCharacterSnapshot(): Promise<void> {
    const client = createClient();
    let saveCalls = 0;

    const originalSaveCharacterSnapshot = JsonAdapter.prototype.saveCharacterSnapshot;
    JsonAdapter.prototype.saveCharacterSnapshot = async function(userId: number, character: Character): Promise<Character[]> {
        saveCalls += 1;
        assert.equal(userId, 6);
        assert.equal(character.questTrackerState, 100);
        return [character];
    };

    try {
        await LevelHandler.handleQuestProgressUpdate(client as never, createQuestProgressPacket(100));
    } finally {
        JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
    }

    assert.equal(client.character.questTrackerState, 100);
    assert.equal(saveCalls, 1);
}

async function testQuestProgressUpdateDoesNotRegressCompletedCraftTownTutorial(): Promise<void> {
    const client = createClient();
    client.character.missions = {
        '5': {
            state: 3,
            currCount: 1,
            claimed: 1,
            complete: 1
        }
    };
    client.character.questTrackerState = 100;

    let saveCalls = 0;
    const originalSaveCharacterSnapshot = JsonAdapter.prototype.saveCharacterSnapshot;
    JsonAdapter.prototype.saveCharacterSnapshot = async function(userId: number, character: Character): Promise<Character[]> {
        saveCalls += 1;
        assert.equal(userId, 6);
        assert.equal(character.questTrackerState, 100);
        return [character];
    };

    try {
        await LevelHandler.handleQuestProgressUpdate(client as never, createQuestProgressPacket(92));
    } finally {
        JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
    }

    assert.equal(client.character.questTrackerState, 100);
    assert.equal(saveCalls, 0);
}

async function testTutorialDungeonQuestProgressStaysAtIntroBaselineUntilDropTutorial(): Promise<void> {
    const client = createClient();
    client.currentLevel = 'TutorialDungeon';
    client.character.CurrentLevel = { name: 'TutorialDungeon', x: 0, y: 0 };
    client.character.PreviousLevel = { name: 'NewbieRoad', x: 1421, y: 826 };
    client.character.questTrackerState = 11;
    (client as any).startedRoomEvents = new Set<string>([
        'TutorialDungeon:0',
        'TutorialDungeon:1',
        'TutorialDungeon:4'
    ]);

    let saveCalls = 0;
    const originalSaveCharacterSnapshot = JsonAdapter.prototype.saveCharacterSnapshot;
    JsonAdapter.prototype.saveCharacterSnapshot = async function(userId: number, character: Character): Promise<Character[]> {
        saveCalls += 1;
        assert.equal(userId, 6);
        assert.equal(character.questTrackerState, 11);
        return [character];
    };

    try {
        await LevelHandler.handleQuestProgressUpdate(client as never, createQuestProgressPacket(100));
    } finally {
        JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
    }

    assert.equal(client.character.questTrackerState, 11);
    assert.equal(saveCalls, 0);
}

function testNormalDungeonEntryStartsAtDungeonProgress(): void {
    ensureLevelConfigLoaded();
    const client = createClient();
    client.currentLevel = 'AC_Mission6';
    client.character.CurrentLevel = { name: 'AC_Mission6', x: 0, y: 0 };
    client.character.questTrackerState = 73;
    client.playerSpawned = true;
    client.sentPackets = [];
    client.send = (id: number, payload: Buffer) => {
        client.sentPackets!.push({ id, payload });
    };

    LevelHandler.prepareDungeonQuestProgressState(client as never);

    assert.equal(client.character.questTrackerState, 0);
    assert.equal(client.sentPackets.length, 1);
    assert.equal(client.sentPackets[0].id, 0xB7);
}

function testSyncedDungeonEntryUsesKnownDungeonProgress(): void {
    ensureLevelConfigLoaded();
    const client = createClient();
    client.currentLevel = 'AC_Mission6';
    client.character.CurrentLevel = { name: 'AC_Mission6', x: 0, y: 0 };
    client.character.questTrackerState = 73;
    client.syncQuestProgress = 42;
    client.playerSpawned = true;
    client.sentPackets = [];
    client.send = (id: number, payload: Buffer) => {
        client.sentPackets!.push({ id, payload });
    };

    LevelHandler.prepareDungeonQuestProgressState(client as never);

    assert.equal(client.character.questTrackerState, 42);
    assert.equal(client.sentPackets.length, 1);
    assert.equal(client.sentPackets[0].id, 0xB7);
}

function testOverworldEntryKeepsSideQuestProgress(): void {
    ensureLevelConfigLoaded();
    const client = createClient();
    client.currentLevel = 'Castle';
    client.character.CurrentLevel = { name: 'Castle', x: 0, y: 0 };
    client.character.questTrackerState = 73;

    LevelHandler.prepareDungeonQuestProgressState(client as never);

    assert.equal(client.character.questTrackerState, 73);
}

async function main(): Promise<void> {
    await testQuestProgressUpdatePersistsCharacterSnapshot();
    await testQuestProgressUpdateDoesNotRegressCompletedCraftTownTutorial();
    await testTutorialDungeonQuestProgressStaysAtIntroBaselineUntilDropTutorial();
    testNormalDungeonEntryStartsAtDungeonProgress();
    testSyncedDungeonEntryUsesKnownDungeonProgress();
    testOverworldEntryKeepsSideQuestProgress();
    console.log('quest_progress_persistence_regression: ok');
}

void main().catch((error) => {
    console.error('quest_progress_persistence_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
