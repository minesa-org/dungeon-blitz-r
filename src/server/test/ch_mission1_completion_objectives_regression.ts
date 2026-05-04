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

async function testWitherDungeonRequiresBossThenChest(): Promise<void> {
    const client = createClient('CH_Mission1', 'boss-then-chest');
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
    const chest = {
        id: 7102,
        name: 'QuestTreasureChest',
        isPlayer: false,
        team: 0,
        hp: 0,
        dead: true,
        clientSpawned: true,
        ownerToken: client.token
    };

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, boss.id, boss);
    addEntity(client, chest.id, chest);

    await withScheduleCapture(async (scheduledScopes) => {
        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(boss.id));
        assert.deepEqual(scheduledScopes, [], 'boss death alone should not complete Wither the Witch');

        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(chest.id));
        assert.deepEqual(scheduledScopes, [levelScope], 'destroying the required chest after the boss should complete the dungeon');
    });
}

async function testWitherDungeonRequiresChestThenBoss(): Promise<void> {
    const client = createClient('CH_Mission1', 'chest-then-boss');
    const levelScope = `${client.currentLevel}#${client.levelInstanceId}`;
    const boss = {
        id: 7201,
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
    addEntity(client, boss.id, boss);
    addEntity(client, chest.id, chest);

    await withScheduleCapture(async (scheduledScopes) => {
        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(chest.id));
        assert.deepEqual(scheduledScopes, [], 'required chest alone should not complete Wither the Witch');

        await CombatHandler.handleEntityDestroy(client as never, createEntityDestroyPacket(boss.id));
        assert.deepEqual(scheduledScopes, [levelScope], 'boss death after the chest should complete the dungeon');
    });
}

async function main(): Promise<void> {
    ensureDataLoaded();
    await testWitherDungeonRequiresBossThenChest();
    await testWitherDungeonRequiresChestThenBoss();
    console.log('ch_mission1_completion_objectives_regression: ok');
}

void main().catch((error) => {
    console.error('ch_mission1_completion_objectives_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
