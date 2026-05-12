import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { CombatHandler } from '../handlers/CombatHandler';
import { MissionHandler } from '../handlers/MissionHandler';
import { GameData } from '../core/GameData';
import { GlobalState } from '../core/GlobalState';
import { LevelConfig } from '../core/LevelConfig';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { EntityTeam } from '../core/Entity';

type FakeClient = {
    token: number;
    userId: number | null;
    character: any;
    characters: any[];
    currentLevel: string;
    levelInstanceId: string;
    forcedDungeonCompletionScope: string;
    activeDungeonCutsceneScope: string;
    playerSpawned: boolean;
    entities: Map<number, any>;
    knownEntityIds: Set<number>;
    startedRoomEvents: Set<string>;
    processedRewardSources: Set<string>;
    sentPackets: Array<{ id: number; payload: Buffer }>;
    sendBitBuffer(id: number, bb: BitBuffer): void;
    send(id: number, payload: Buffer): void;
};

function ensureDataLoaded(): void {
    const sourceDataDir = path.resolve(__dirname, '../data');
    const compiledDataDir = path.resolve(__dirname, '../../data');
    const dataDir = fs.existsSync(path.join(sourceDataDir, 'level_config.json'))
        ? sourceDataDir
        : compiledDataDir;
    if (!LevelConfig.has('CH_Mission1')) {
        LevelConfig.load(dataDir);
    }
    if (!GameData.getEntType('MummyBoss') || !GameData.getEntType('QuestTreasureChest')) {
        GameData.load(dataDir);
    }
}

function createClient(levelName: string, levelInstanceId: string): FakeClient {
    const sentPackets: Array<{ id: number; payload: Buffer }> = [];
    const character = {
        name: `WitherTester-${levelInstanceId}`,
        CurrentLevel: { name: levelName, x: 0, y: 0 },
        missions: {
            '40': { state: 1, currCount: 0 },
            '150': { state: 1, currCount: 0 }
        }
    };

    return {
        token: Math.floor(Math.random() * 100000) + 1000,
        userId: null,
        character,
        characters: [character],
        currentLevel: levelName,
        levelInstanceId,
        forcedDungeonCompletionScope: '',
        activeDungeonCutsceneScope: '',
        playerSpawned: true,
        entities: new Map<number, any>(),
        knownEntityIds: new Set<number>(),
        startedRoomEvents: new Set<string>(),
        processedRewardSources: new Set<string>(),
        sentPackets,
        sendBitBuffer(id: number, bb: BitBuffer) {
            sentPackets.push({ id, payload: bb.toBuffer() });
        },
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        }
    };
}

function createEntityDestroyPacket(entityId: number): Buffer {
    const bb = new BitBuffer();
    bb.writeMethod9(entityId);
    return bb.toBuffer();
}

function addEntity(client: FakeClient, entityId: number, entity: any): void {
    const levelScope = `${client.currentLevel}#${client.levelInstanceId}`;
    client.entities.set(entityId, entity);
    let levelEntities = GlobalState.levelEntities.get(levelScope);
    if (!levelEntities) {
        levelEntities = new Map<number, any>();
        GlobalState.levelEntities.set(levelScope, levelEntities);
    }
    levelEntities.set(entityId, entity);
}

async function withScheduleCapture(run: (scheduledScopes: string[]) => Promise<void>): Promise<void> {
    const originalEnemyProgress = MissionHandler.handleEnemyDefeatMissionProgress;
    const originalSchedule = MissionHandler.scheduleDungeonCompletion;
    const scheduledScopes: string[] = [];

    MissionHandler.handleEnemyDefeatMissionProgress = async () => undefined;
    MissionHandler.scheduleDungeonCompletion = ((client: any, _payload: Buffer, options: any = {}) => {
        scheduledScopes.push(String(options?.forcedDungeonCompletionScope ?? `${client.currentLevel}#${client.levelInstanceId}`));
        client.forcedDungeonCompletionScope = String(options?.forcedDungeonCompletionScope ?? '');
    }) as typeof MissionHandler.scheduleDungeonCompletion;

    try {
        await run(scheduledScopes);
    } finally {
        MissionHandler.handleEnemyDefeatMissionProgress = originalEnemyProgress;
        MissionHandler.scheduleDungeonCompletion = originalSchedule;
    }
}

async function testWitherDungeonCompletesOnBossDeath(): Promise<void> {
    const client = createClient('CH_Mission1', 'boss-only');
    const levelScope = `${client.currentLevel}#${client.levelInstanceId}`;
    const boss = {
        id: 7101,
        name: 'MummyBoss',
        isPlayer: false,
        team: EntityTeam.ENEMY,
        entRank: 'Boss',
        entState: 0,
        hp: 10,
        dead: false,
        clientSpawned: true,
        ownerToken: client.token
    };

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, boss.id, boss);

    await withScheduleCapture(async (scheduledScopes) => {
        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(boss.id));
        assert.deepEqual(scheduledScopes, [levelScope], 'boss death alone should complete Wither the Witch');
    });
}

async function testWitherDungeonIgnoresHiddenChest(): Promise<void> {
    const client = createClient('CH_Mission1', 'chest-ignored');
    const chest = {
        id: 7202,
        name: 'QuestTreasureChest',
        isPlayer: false,
        team: 0,
        hp: 0,
        dead: true,
        clientSpawned: true,
        ownerToken: client.token
    };

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, chest.id, chest);

    await withScheduleCapture(async (scheduledScopes) => {
        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(chest.id));
        assert.deepEqual(scheduledScopes, [], 'hidden chest destruction should not complete Wither the Witch without the boss');
    });
}

async function testWitherDungeonIgnoresAllChestsAfterBossDeath(): Promise<void> {
    const client = createClient('CH_Mission1', 'boss-and-chests-ignored');
    const levelScope = `${client.currentLevel}#${client.levelInstanceId}`;
    const boss = {
        id: 7301,
        name: 'MummyBoss',
        isPlayer: false,
        team: EntityTeam.ENEMY,
        entRank: 'Boss',
        entState: 0,
        hp: 10,
        dead: false,
        clientSpawned: true,
        ownerToken: client.token,
        roomId: 6
    };
    const hiddenChest = {
        id: 7302,
        name: 'QuestTreasureChest',
        isPlayer: false,
        team: 0,
        hp: 0,
        dead: true,
        clientSpawned: true,
        ownerToken: client.token,
        roomId: 6
    };
    const normalChest = {
        id: 7303,
        name: 'TreasureChestEmpty',
        isPlayer: false,
        team: 0,
        hp: 10,
        dead: false,
        clientSpawned: true,
        ownerToken: client.token,
        roomId: 6
    };

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, boss.id, boss);
    addEntity(client, hiddenChest.id, hiddenChest);
    addEntity(client, normalChest.id, normalChest);

    await withScheduleCapture(async (scheduledScopes) => {
        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(boss.id));
        assert.deepEqual(scheduledScopes, [levelScope], 'boss death should complete Wither the Witch even when hidden and ordinary chests remain');

        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(hiddenChest.id));
        assert.deepEqual(
            scheduledScopes,
            [levelScope],
            'hidden chest destruction should not schedule another Wither completion'
        );
    });
}

async function testWitherDungeonUsesOnlyBossKilledFlag(): Promise<void> {
    const client = createClient('CH_Mission1', 'boss-flag-only');
    const levelScope = `${client.currentLevel}#${client.levelInstanceId}`;
    const boss = {
        id: 7401,
        name: 'MummyBoss',
        isPlayer: false,
        team: EntityTeam.ENEMY,
        entRank: 'Boss',
        entState: 0,
        hp: 10,
        dead: false,
        clientSpawned: true,
        ownerToken: client.token,
        roomId: 8
    };
    const deadBossReport = {
        ...boss,
        entState: 6,
        hp: 0,
        dead: true
    };

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, boss.id, boss);

    await withScheduleCapture(async (scheduledScopes) => {
        await MissionHandler.handleForcedDungeonBossCompletion(client as never, deadBossReport);
        assert.deepEqual(
            scheduledScopes,
            [levelScope],
            'Wither the Witch should key only on the boss-killed flag'
        );
    });
}

async function main(): Promise<void> {
    ensureDataLoaded();
    await testWitherDungeonCompletesOnBossDeath();
    await testWitherDungeonIgnoresHiddenChest();
    await testWitherDungeonIgnoresAllChestsAfterBossDeath();
    await testWitherDungeonUsesOnlyBossKilledFlag();
    console.log('ch_mission1_completion_objectives_regression: ok');
}

void main().catch((error) => {
    console.error('ch_mission1_completion_objectives_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
