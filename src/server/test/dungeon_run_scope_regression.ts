import { strict as assert } from 'assert';
import * as path from 'path';
import { Character } from '../database/Database';
import { GlobalState } from '../core/GlobalState';
import { MissionHandler } from '../handlers/MissionHandler';
import { EntityHandler } from '../handlers/EntityHandler';
import { LevelConfig } from '../core/LevelConfig';
import { MissionLoader } from '../data/MissionLoader';
import { BitBuffer } from '../network/protocol/bitBuffer';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    userId: number | null;
    character: Character;
    characters: Character[];
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    clientEntID: number;
    playerSpawned: boolean;
    syncedQuestTrackerState: number | null;
    syncedDungeonMissionId: number;
    syncedDungeonMissionState: number;
    syncedDungeonMissionProgress: number | null;
    startedRoomEvents: Set<string>;
    entities: Map<number, any>;
    knownEntityIds: Set<number>;
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

let nextToken = 8000;

function ensureDataLoaded(): void {
    if (!LevelConfig.has('TutorialDungeon')) {
        LevelConfig.load(path.resolve(__dirname, '../data'));
    }
    if (!MissionLoader.getMissionDef(3)) {
        MissionLoader.load(path.resolve(__dirname, '../data'));
    }
}

function createCharacter(name: string): Character {
    return {
        name,
        class: 'Paladin',
        gender: 'male',
        level: 1,
        questTrackerState: 0,
        CurrentLevel: { name: 'TutorialDungeon', x: 1421, y: 826 },
        PreviousLevel: { name: 'NewbieRoad', x: 0, y: 0 },
        missions: {
            '3': {
                state: 1,
                currCount: 12
            }
        }
    };
}

function createClient(name: string): FakeClient {
    const sentPackets: SentPacket[] = [];
    return {
        token: nextToken++,
        userId: null,
        character: createCharacter(name),
        characters: [],
        currentLevel: 'TutorialDungeon',
        levelInstanceId: 'completed-run',
        currentRoomId: 9,
        clientEntID: 0,
        playerSpawned: true,
        syncedQuestTrackerState: null,
        syncedDungeonMissionId: 0,
        syncedDungeonMissionState: 0,
        syncedDungeonMissionProgress: null,
        startedRoomEvents: new Set<string>(),
        entities: new Map<number, any>(),
        knownEntityIds: new Set<number>(),
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, bb: BitBuffer) {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function seedDungeonRun(): void {
    GlobalState.dungeonRunsByScope.set('TutorialDungeon#completed-run', {
        scopeKey: 'TutorialDungeon#completed-run',
        levelName: 'TutorialDungeon',
        levelInstanceId: 'completed-run',
        authorityToken: 9001,
        participantKeys: new Set<string>(['scout']),
        claimedCompletionKeys: new Set<string>(),
        currentRoomId: 9,
        startedRoomIds: new Set<number>([0, 9]),
        questTrackerState: 100,
        dungeonMissionId: 3,
        dungeonMissionState: 2,
        dungeonMissionProgress: 62,
        completed: true,
        createdAt: 1,
        lastActiveAt: 1,
        expiresAt: 0
    });
}

async function testLateJoinerClaimsCompletedDungeonRunFromScope(): Promise<void> {
    const client = createClient('Scout');
    seedDungeonRun();

    await MissionHandler.claimCompletedDungeonRunForClient(client as never);

    assert.equal(client.character.questTrackerState, 100);
    assert.equal(client.syncedQuestTrackerState, 100);
    assert.equal(client.syncedDungeonMissionId, 3);
    assert.equal(client.syncedDungeonMissionState, 2);
    assert.equal(client.syncedDungeonMissionProgress, 62);
    assert.equal((client.character.missions as any)['3']?.state, 2);
    assert.equal(GlobalState.dungeonRunsByScope.get('TutorialDungeon#completed-run')?.claimedCompletionKeys.has('scout'), true);
}

function testDisconnectPreservesDungeonRunCanonicalHostiles(): void {
    const owner = createClient('Owner');
    owner.clientEntID = 42;

    GlobalState.levelEntities.set('TutorialDungeon#completed-run', new Map<number, any>([
        [42, { id: 42, name: 'Owner', isPlayer: true, ownerToken: owner.token }],
        [901, {
            id: 901,
            name: 'IntroGoblin',
            isPlayer: false,
            team: 2,
            clientSpawned: true,
            ownerToken: owner.token,
            authorityToken: owner.token,
            roomId: 9,
            spawnX: 100,
            spawnY: 200,
            spawnSignature: 'TutorialDungeon:9:2:introgoblin:100:200'
        }]
    ]));

    const removed = EntityHandler.removeOwnedEntities(owner as never);
    const levelMap = GlobalState.levelEntities.get('TutorialDungeon#completed-run');

    assert.deepEqual(removed, [42], 'disconnect should only remove the local player entity from a run-owned dungeon scope');
    assert.equal(levelMap?.has(901), true, 'canonical run-owned hostile should survive authority disconnect cleanup');
}

async function main(): Promise<void> {
    ensureDataLoaded();

    const dungeonRunsByScope = new Map(GlobalState.dungeonRunsByScope);
    const levelEntities = new Map(GlobalState.levelEntities);

    GlobalState.dungeonRunsByScope.clear();
    GlobalState.levelEntities.clear();

    try {
        await testLateJoinerClaimsCompletedDungeonRunFromScope();

        GlobalState.dungeonRunsByScope.clear();
        GlobalState.levelEntities.clear();

        testDisconnectPreservesDungeonRunCanonicalHostiles();
    } finally {
        GlobalState.dungeonRunsByScope = dungeonRunsByScope;
        GlobalState.levelEntities = levelEntities;
    }

    console.log('dungeon_run_scope_regression: ok');
}

void main().catch((error) => {
    console.error('dungeon_run_scope_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
