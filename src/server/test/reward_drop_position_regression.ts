import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import { getClientLevelScope } from '../core/LevelScope';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';
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
    if (!GameData.getEntType('GoblinBrute')) {
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

function buildGrantRewardPayload(sourceId: number, worldX: number, worldY: number, gold: number): Buffer {
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
    bb.writeMethod4(gold);
    bb.writeMethod24(worldX);
    bb.writeMethod24(worldY);
    bb.writeMethod15(false);
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

function decodeLootdropPosition(payload: Buffer): { x: number; y: number } {
    const br = new BitReader(payload);
    br.readMethod4();
    return {
        x: br.readMethod45(),
        y: br.readMethod45()
    };
}

function findLootdropPacket(client: FakeClient): SentPacket {
    const packet = client.sentPackets.find((entry) => entry.id === 0x32);
    assert.ok(packet, 'reward should emit a lootdrop packet');
    return packet!;
}

async function testRewardPacketCoordsOverrideEntityHeight(): Promise<void> {
    const alpha = createFakeClient(1, 'Alpha');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9301;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBrute',
        isPlayer: false,
        team: 2,
        x: 440,
        y: 520
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['alpha']);

    await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, 180, 260, 25));

    const { x, y } = decodeLootdropPosition(findLootdropPacket(alpha).payload);
    assert.equal(x, 180, 'lootdrop should use the floor-corrected reward X coordinate');
    assert.equal(y, 260, 'lootdrop should use the floor-corrected reward Y coordinate');
}

async function testFlyingRewardPacketCoordsOverridePlayerY(): Promise<void> {
    const alpha = createFakeClient(2, 'Beta');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    alpha.entities.set(alpha.clientEntID, {
        id: alpha.clientEntID,
        name: 'Player',
        isPlayer: true,
        x: 200,
        y: 410,
        team: 1
    });

    const sourceId = 9302;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'DragonFlyer',
        isPlayer: false,
        team: 2,
        x: 300,
        y: 120
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['beta']);

    await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, 295, 238, 30));

    const { x, y } = decodeLootdropPosition(findLootdropPacket(alpha).payload);
    assert.equal(x, 295, 'flying lootdrop should keep the reward packet X coordinate');
    assert.equal(y, 238, 'flying lootdrop should not be snapped to the player Y position');
}

async function main(): Promise<void> {
    ensureGameDataLoaded();

    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    const levelEntities = new Map(GlobalState.levelEntities);
    const combatContributions = new Map(GlobalState.combatContributions);

    try {
        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testRewardPacketCoordsOverrideEntityHeight();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testFlyingRewardPacketCoordsOverridePlayerY();

        console.log('reward_drop_position_regression: ok');
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
        GlobalState.combatContributions = combatContributions;
    }
}

void main().catch((error) => {
    console.error('reward_drop_position_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
