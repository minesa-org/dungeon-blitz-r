import { strict as assert } from 'assert';
import * as path from 'path';
import { EntityState, EntityTeam } from '../core/Entity';
import { GlobalState } from '../core/GlobalState';
import { LevelConfig } from '../core/LevelConfig';
import { getClientLevelScope } from '../core/LevelScope';
import { MissionHandler } from '../handlers/MissionHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

type FakeClient = {
    token: number;
    userId: number | null;
    character: any;
    characters: any[];
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    forcedDungeonCompletionScope: string;
    activeDungeonCutsceneScope: string;
    playerSpawned: boolean;
    entities: Map<number, any>;
    knownEntityIds: Set<number>;
    sentPackets: Array<{ id: number; payload: Buffer }>;
    sendBitBuffer(id: number, bb: BitBuffer): void;
    send(id: number, payload: Buffer): void;
};

function ensureDataLoaded(): void {
    if (!LevelConfig.has('JC_Mission2')) {
        LevelConfig.load(path.resolve(__dirname, '../data'));
    }
}

function createClient(levelName: string = 'JC_Mission2', flowId: string = 'boss-flow'): FakeClient {
    const sentPackets: Array<{ id: number; payload: Buffer }> = [];
    const character = {
        name: `${levelName}BossTester`,
        CurrentLevel: { name: levelName, x: 0, y: 0 },
        missions: {}
    };

    return {
        token: levelName.endsWith('Hard') ? 9122 : 9121,
        userId: null,
        character,
        characters: [character],
        currentLevel: levelName,
        levelInstanceId: `${levelName.toLowerCase()}-${flowId}`,
        currentRoomId: 8,
        forcedDungeonCompletionScope: '',
        activeDungeonCutsceneScope: '',
        playerSpawned: true,
        entities: new Map<number, any>(),
        knownEntityIds: new Set<number>(),
        sentPackets,
        sendBitBuffer(id: number, bb: BitBuffer): void {
            sentPackets.push({ id, payload: bb.toBuffer() });
        },
        send(id: number, payload: Buffer): void {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        }
    };
}

function addEntity(client: FakeClient, entity: any): void {
    client.entities.set(entity.id, entity);
    const levelScope = getClientLevelScope(client as never);
    let levelEntities = GlobalState.levelEntities.get(levelScope);
    if (!levelEntities) {
        levelEntities = new Map<number, any>();
        GlobalState.levelEntities.set(levelScope, levelEntities);
    }
    levelEntities.set(entity.id, entity);
}

function createBoss(id: number, name: string, playerDamageContributed: boolean = true): any {
    return {
        id,
        name,
        isPlayer: false,
        team: EntityTeam.ENEMY,
        entRank: 'Boss',
        entState: EntityState.DEAD,
        hp: 0,
        dead: true,
        clientSpawned: true,
        playerDamageContributed,
        roomId: 8
    };
}

function createAliveBoss(id: number, name: string): any {
    return {
        ...createBoss(id, name),
        entState: EntityState.ACTIVE,
        hp: 100,
        maxHp: 100,
        dead: false
    };
}

async function withScheduleCapture(run: (scheduled: Array<{ scope: string; waitForCutsceneEnd: boolean }>) => Promise<void>): Promise<void> {
    const originalSchedule = MissionHandler.scheduleDungeonCompletion;
    const scheduled: Array<{ scope: string; waitForCutsceneEnd: boolean }> = [];

    MissionHandler.scheduleDungeonCompletion = ((client: any, _payload: Buffer, options: any = {}) => {
        scheduled.push({
            scope: String(options?.forcedDungeonCompletionScope ?? `${client.currentLevel}#${client.levelInstanceId}`),
            waitForCutsceneEnd: Boolean(options?.waitForCutsceneEnd)
        });
        client.forcedDungeonCompletionScope = String(options?.forcedDungeonCompletionScope ?? '');
    }) as typeof MissionHandler.scheduleDungeonCompletion;

    try {
        await run(scheduled);
    } finally {
        MissionHandler.scheduleDungeonCompletion = originalSchedule;
    }
}

async function testBackAlleyDealsWaitsForBothBosses(): Promise<void> {
    const client = createClient('JC_Mission2', 'both-bosses-flow');
    const levelScope = getClientLevelScope(client as never);
    const firstBoss = createBoss(9201, 'GreaterBoneGolem');
    const secondBoss = createAliveBoss(9202, 'GreaterBoneGolem2');

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, firstBoss);
    addEntity(client, secondBoss);

    await withScheduleCapture(async (scheduled) => {
        await MissionHandler.handleForcedDungeonBossCompletion(client as never, firstBoss);
        assert.deepEqual(scheduled, [], 'Back Alley Deals should not complete after only the first boss dies');

        secondBoss.entState = EntityState.DEAD;
        secondBoss.hp = 0;
        secondBoss.dead = true;
        await MissionHandler.handleForcedDungeonBossCompletion(client as never, secondBoss);
        assert.deepEqual(
            scheduled,
            [{ scope: levelScope, waitForCutsceneEnd: true }],
            'Back Alley Deals should complete after both bosses die and wait for the defeat cutscene'
        );
    });
}

async function testBackAlleyDealsAcceptsPlayerDamageEvidenceFromScopedBoss(): Promise<void> {
    const client = createClient('JC_Mission2', 'scoped-damage-evidence-flow');
    const levelScope = getClientLevelScope(client as never);
    const firstBoss = createBoss(9251, 'GreaterBoneGolem');
    const secondBoss = createBoss(9252, 'GreaterBoneGolem2');
    const secondBossReport = {
        ...secondBoss,
        playerDamageContributed: false
    };

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, firstBoss);
    addEntity(client, secondBoss);

    await withScheduleCapture(async (scheduled) => {
        await MissionHandler.handleForcedDungeonBossCompletion(client as never, firstBoss);
        await MissionHandler.handleForcedDungeonBossCompletion(client as never, secondBossReport);
        assert.deepEqual(
            scheduled,
            [{ scope: levelScope, waitForCutsceneEnd: true }],
            'Back Alley boss defeat reports should accept player damage evidence already recorded on the scoped entity'
        );
    });
}

async function testBackAlleyDealsIgnoresClientSpawnedBossWithoutPlayerDamage(): Promise<void> {
    const client = createClient('JC_Mission2', 'missing-player-damage-flow');
    const firstBoss = createBoss(9301, 'GreaterBoneGolem', false);
    const secondBoss = createBoss(9302, 'GreaterBoneGolem2');

    GlobalState.sessionsByToken.set(client.token, client as never);
    addEntity(client, firstBoss);
    addEntity(client, secondBoss);

    await withScheduleCapture(async (scheduled) => {
        await MissionHandler.handleForcedDungeonBossCompletion(client as never, firstBoss);
        await MissionHandler.handleForcedDungeonBossCompletion(client as never, secondBoss);
        assert.deepEqual(
            scheduled,
            [],
            'client-spawned Back Alley boss reports without player damage evidence should not complete the dungeon'
        );
    });
}

async function main(): Promise<void> {
    ensureDataLoaded();
    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    const levelEntities = new Map(GlobalState.levelEntities);

    try {
        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        await testBackAlleyDealsWaitsForBothBosses();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        await testBackAlleyDealsAcceptsPlayerDamageEvidenceFromScopedBoss();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        await testBackAlleyDealsIgnoresClientSpawnedBossWithoutPlayerDamage();
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
    }

    console.log('back_alley_completion_objectives_regression: ok');
}

void main().catch((error) => {
    console.error('back_alley_completion_objectives_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
