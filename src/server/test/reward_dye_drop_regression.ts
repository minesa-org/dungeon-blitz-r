import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import { getClientLevelScope } from '../core/LevelScope';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { RewardHandler } from '../handlers/RewardHandler';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    userId: number | null;
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    playerSpawned: boolean;
    clientEntID: number;
    character: any;
    characters: any[];
    authoritativeMaxHp: number;
    authoritativeCurrentHp: number;
    processedRewardSources: Set<string>;
    pendingLoot: Map<number, any>;
    knownEntityIds: Set<number>;
    entities: Map<number, any>;
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, payload: BitBuffer) => void;
};

function ensureGameDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!GameData.getEntType('GoblinDagger')) {
        GameData.load(dataDir);
    }
}

function createFakeClient(token: number, name: string): FakeClient {
    const sentPackets: SentPacket[] = [];
    return {
        token,
        userId: null,
        currentLevel: 'GoblinRiverDungeon',
        levelInstanceId: '',
        currentRoomId: 1,
        playerSpawned: true,
        clientEntID: token + 1000,
        character: {
            name,
            level: 20,
            class: 'Mage',
            xp: 0,
            gold: 0,
            materials: [],
            inventoryGears: [],
            equippedGears: [],
            OwnedDyes: []
        },
        characters: [],
        authoritativeMaxHp: 100,
        authoritativeCurrentHp: 100,
        processedRewardSources: new Set<string>(),
        pendingLoot: new Map<number, any>(),
        knownEntityIds: new Set<number>(),
        entities: new Map<number, any>(),
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, payload: BitBuffer) {
            sentPackets.push({ id, payload: payload.toBuffer() });
        }
    };
}

function buildGrantRewardPayload(sourceId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(0);
    bb.writeMethod4(sourceId);
    bb.writeMethod15(false);
    bb.writeMethod309(1);
    bb.writeMethod15(false);
    bb.writeMethod309(1);
    bb.writeMethod15(false);
    bb.writeMethod15(false);
    bb.writeMethod4(0);
    bb.writeMethod4(0);
    bb.writeMethod4(0);
    bb.writeMethod4(0);
    bb.writeMethod24(120);
    bb.writeMethod24(220);
    bb.writeMethod15(false);
    return bb.toBuffer();
}

function buildPickupPayload(lootId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(lootId);
    return bb.toBuffer();
}

function addLevelEntity(client: FakeClient, entity: any): void {
    const scope = getClientLevelScope(client as never);
    let levelMap = GlobalState.levelEntities.get(scope);
    if (!levelMap) {
        levelMap = new Map<number, any>();
        GlobalState.levelEntities.set(scope, levelMap);
    }
    levelMap.set(Number(entity.id), entity);
}

function setContributors(levelScope: string, sourceId: number, contributors: string[]): void {
    const key = `${levelScope}:${sourceId}:0`;
    const contributionMap = new Map<string, number>();
    for (const contributor of contributors) {
        contributionMap.set(contributor.toLowerCase(), 100);
    }
    GlobalState.combatContributions.set(key, contributionMap);
}

async function withMockedRandom(values: number[], fn: () => Promise<void>): Promise<void> {
    const originalRandom = Math.random;
    let index = 0;
    Math.random = () => values[Math.min(index++, values.length - 1)] ?? 0;

    try {
        await fn();
    } finally {
        Math.random = originalRandom;
    }
}

async function testEnemyRewardCanSpawnAndGrantDye(): Promise<void> {
    ensureGameDataLoaded();

    const alpha = createFakeClient(2, 'Alpha');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9100;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinDagger',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['alpha']);

    await withMockedRandom([0.95, 0, 0.4, 0.99, 0.99, 0.2, 0.3, 0.4], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId));
    });

    const dyeEntry = Array.from(alpha.pendingLoot.entries()).find(([, reward]) => Number(reward?.dye ?? 0) > 0);
    assert.ok(dyeEntry, 'enemy reward should queue a dye lootdrop when the dye roll succeeds');

    const [lootId, reward] = dyeEntry!;
    const dyeId = Number(reward.dye ?? 0);
    assert.ok(dyeId > 0, 'queued dye loot should include a dye id');

    await RewardHandler.handlePickupLootdrop(alpha as never, buildPickupPayload(lootId));

    assert.equal(alpha.character.OwnedDyes.includes(dyeId), true, 'picking up dye loot should persist the owned dye');
    assert.equal(alpha.sentPackets.some((packet) => packet.id === 0x10A), true, 'picking up dye loot should emit the dye reward packet');
}

async function main(): Promise<void> {
    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    const levelEntities = new Map(GlobalState.levelEntities);
    const combatContributions = new Map(GlobalState.combatContributions);

    try {
        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testEnemyRewardCanSpawnAndGrantDye();
        console.log('reward_dye_drop_regression: ok');
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
        GlobalState.combatContributions = combatContributions;
    }
}

void main().catch((error) => {
    console.error('reward_dye_drop_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
