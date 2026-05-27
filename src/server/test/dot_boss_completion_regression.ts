import { strict as assert } from 'assert';
import * as path from 'path';
import { GameData } from '../core/GameData';
import { GlobalState } from '../core/GlobalState';
import { LevelConfig } from '../core/LevelConfig';
import { getClientLevelScope } from '../core/LevelScope';
import { EntityState, EntityTeam } from '../core/Entity';
import { MissionID } from '../data/runtime';
import { CombatHandler } from '../handlers/CombatHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

type FakeClient = {
    token: number;
    clientEntID: number;
    userId: number | null;
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    playerSpawned: boolean;
    forcedDungeonCompletionScope: string;
    character: any;
    entities: Map<number, any>;
    knownEntityIds: Set<number>;
    entityIdAliases: Map<number, number>;
    pendingLoot: Map<number, any>;
    processedRewardSources: Set<string>;
    sentPackets: Array<{ id: number; payload: Buffer }>;
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

function ensureDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!LevelConfig.has('SRN_Mission1')) {
        LevelConfig.load(dataDir);
    }
    if (!GameData.getEntType('LizardLord')) {
        GameData.load(dataDir);
    }
}

function createClient(): FakeClient {
    const sentPackets: Array<{ id: number; payload: Buffer }> = [];
    return {
        token: 7111,
        clientEntID: 101,
        userId: null,
        currentLevel: 'SRN_Mission1',
        levelInstanceId: 'dot-boss-flow',
        currentRoomId: 3,
        playerSpawned: true,
        forcedDungeonCompletionScope: '',
        character: {
            name: 'DotBossTester',
            level: 10,
            CurrentLevel: { name: 'SRN_Mission1', x: 0, y: 0 },
            PreviousLevel: { name: 'SwampRoadNorth', x: 0, y: 0 },
            missions: {
                [String(MissionID.StopCastout)]: {
                    state: 1,
                    currCount: 0
                }
            },
            questTrackerState: 64
        },
        entities: new Map(),
        knownEntityIds: new Set([101, 9001]),
        entityIdAliases: new Map(),
        pendingLoot: new Map(),
        processedRewardSources: new Set(),
        sentPackets,
        send(id: number, payload: Buffer): void {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, bb: BitBuffer): void {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function createBuffTickDotPacket(targetId: number, sourceId: number, powerId: number, damage: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(targetId);
    bb.writeMethod4(sourceId);
    bb.writeMethod4(powerId);
    bb.writeMethod45(damage);
    bb.writeMethod20(5, 0);
    return bb.toBuffer();
}

async function testLethalDotDefersDungeonBossCompletionUntilDestroy(): Promise<void> {
    const client = createClient();
    const levelScope = getClientLevelScope(client as never);
    const boss: any = {
        id: 9001,
        name: 'LizardLord',
        team: EntityTeam.ENEMY,
        isPlayer: false,
        hp: 5,
        maxHp: 5,
        entState: EntityState.ACTIVE,
        roomId: 3,
        clientSpawned: false
    };
    const levelEntities = new Map<number, any>([
        [client.clientEntID, {
            id: client.clientEntID,
            name: client.character.name,
            team: 1,
            isPlayer: true,
            ownerToken: client.token,
            roomId: 3
        }],
        [boss.id, boss]
    ]);

    GlobalState.sessionsByToken.set(client.token, client as never);
    GlobalState.levelEntities.set(levelScope, levelEntities);
    client.entities.set(boss.id, boss);

    await CombatHandler.handleBuffTickDot(client as never, createBuffTickDotPacket(boss.id, client.clientEntID, 1234, 10));

    assert.equal(boss.dead, true, 'lethal DoT should still reduce the boss to dead HP');
    assert.equal(
        Boolean(boss.questDefeatProcessed),
        false,
        'lethal DoT should not process required dungeon boss completion before the destroy packet'
    );

    const destroy = new BitBuffer(false);
    destroy.writeMethod4(boss.id);
    destroy.writeMethod15(true);
    await CombatHandler.handleEntityDestroy(client as never, destroy.toBuffer());

    assert.equal(
        Boolean(boss.questDefeatProcessed),
        true,
        'the subsequent destroy packet should process the boss defeat once'
    );
}

async function main(): Promise<void> {
    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    const levelEntities = new Map(GlobalState.levelEntities);
    ensureDataLoaded();
    try {
        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        await testLethalDotDefersDungeonBossCompletionUntilDestroy();
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
    }
    console.log('dot_boss_completion_regression: ok');
}

void main().catch((error) => {
    console.error('dot_boss_completion_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
