import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import { getClientLevelScope } from '../core/LevelScope';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { RewardHandler } from '../handlers/RewardHandler';

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
        send() {},
        sendBitBuffer() {}
    };
}

function buildGrantRewardPayload(
    sourceId: number,
    options: {
        dropItem?: boolean;
        itemMultiplier?: number;
        dropGear?: boolean;
        gearMultiplier?: number;
        dropMaterial?: boolean;
    } = {}
): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(0);
    bb.writeMethod4(sourceId);
    bb.writeMethod15(Boolean(options.dropItem));
    bb.writeMethod309(options.itemMultiplier ?? 1);
    bb.writeMethod15(Boolean(options.dropGear));
    bb.writeMethod309(options.gearMultiplier ?? 1);
    bb.writeMethod15(Boolean(options.dropMaterial));
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

function findLoot(client: FakeClient, key: 'gear' | 'material'): any {
    return Array.from(client.pendingLoot.values()).find((reward) => Number(reward?.[key] ?? 0) > 0) ?? null;
}

function getMaterialRarity(materialId: number): string {
    return String(GameData.MATERIALS.find((material) => Number(material.MaterialID ?? 0) === materialId)?.Rarity ?? '');
}

async function testSimpleLootMinionDoesNotDropGear(): Promise<void> {
    const alpha = createFakeClient(1, 'Alpha');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9001;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinDagger',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['alpha']);

    await withMockedRandom([0.0, 0.0, 0.0, 0.0], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropItem: true,
            itemMultiplier: 10,
            dropGear: true
        }));
    });

    assert.equal(findLoot(alpha, 'gear'), null, 'SimpleLoot minions should not create gear lootdrops');
}

async function testRandomItemLieutenantUsesItemDropChanceForGear(): Promise<void> {
    const alpha = createFakeClient(2, 'Beta');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9002;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBrute',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['beta']);

    await withMockedRandom([0.5, 0.2, 0.0, 0.99], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropGear: true,
            dropItem: false
        }));
    });

    assert.equal(findLoot(alpha, 'gear'), null, 'Lieutenant gear should not drop when the 10% roll fails');

    alpha.pendingLoot.clear();
    alpha.processedRewardSources.clear();

    await withMockedRandom([0.5, 0.05, 0.0, 0.99], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropGear: true,
            dropItem: false
        }));
    });

    assert.ok(findLoot(alpha, 'gear'), 'Lieutenant gear should drop when the 10% roll succeeds');
}

async function testMaterialRequiresExplicitDropFlag(): Promise<void> {
    const alpha = createFakeClient(3, 'Gamma');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9003;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBoss1',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['gamma']);

    await withMockedRandom([0.0, 0.99, 0.0, 0.99], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropMaterial: false,
            gearMultiplier: 10
        }));
    });

    assert.equal(findLoot(alpha, 'material'), null, 'material should not drop when dropMaterial is false');

    alpha.pendingLoot.clear();
    alpha.processedRewardSources.clear();

    await withMockedRandom([0.0, 0.99, 0.0, 0.99], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropMaterial: true,
            gearMultiplier: 1
        }));
    });

    assert.ok(findLoot(alpha, 'material'), 'material should drop when dropMaterial is true and the boss roll succeeds');
}

async function testGearRarityTracksValueTier(): Promise<void> {
    const alpha = createFakeClient(4, 'Delta');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9004;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBrute',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['delta']);

    await withMockedRandom([0.5, 0.05, 0.0, 0.10], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropGear: true
        }));
    });
    assert.equal(findLoot(alpha, 'gear')?.tier, 0, 'random-item common gear should map to tier 0');

    alpha.pendingLoot.clear();
    alpha.processedRewardSources.clear();

    await withMockedRandom([0.5, 0.05, 0.0, 0.92], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropGear: true
        }));
    });
    assert.equal(findLoot(alpha, 'gear')?.tier, 1, 'random-item rare gear should map to tier 1');

    alpha.pendingLoot.clear();
    alpha.processedRewardSources.clear();
    alpha.currentLevel = 'GoblinRiverDungeonHard';
    GlobalState.levelEntities.clear();
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBoss1Hard',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['delta']);

    await withMockedRandom([0.0, 0.99, 0.0, 0.95], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropGear: true
        }));
    });
    assert.equal(findLoot(alpha, 'gear')?.tier, 2, 'hard fixed-item bosses should be able to produce legendary gear');
}

async function testOwnedGearDoesNotDropAgain(): Promise<void> {
    const alpha = createFakeClient(6, 'Zeta');
    alpha.character.inventoryGears = [{ gearID: 796, tier: 0, runes: [0, 0, 0], colors: [0, 0] }];
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9006;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBrute',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['zeta']);

    await withMockedRandom([0.5, 0.05, 0.0, 0.1], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropGear: true
        }));
    });

    assert.equal(
        Array.from(alpha.pendingLoot.values()).some((reward) => Number(reward?.gear ?? 0) === 796),
        false,
        'already-owned gear should be excluded from future enemy drops'
    );
}

async function testMaterialRarityTracksValueTier(): Promise<void> {
    const alpha = createFakeClient(5, 'Epsilon');
    GlobalState.sessionsByToken.set(alpha.token, alpha as never);

    const sourceId = 9005;
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBoss1',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['epsilon']);

    await withMockedRandom([0.5, 0.0, 0.10, 0.1], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropMaterial: true
        }));
    });
    assert.equal(getMaterialRarity(findLoot(alpha, 'material')?.material ?? 0), 'M', 'normal material roll should usually produce common material');

    alpha.pendingLoot.clear();
    alpha.processedRewardSources.clear();

    await withMockedRandom([0.5, 0.0, 0.90, 0.1], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropMaterial: true
        }));
    });
    assert.equal(getMaterialRarity(findLoot(alpha, 'material')?.material ?? 0), 'R', 'higher material rarity rolls should produce rare material');

    alpha.pendingLoot.clear();
    alpha.processedRewardSources.clear();
    alpha.currentLevel = 'GoblinRiverDungeonHard';
    GlobalState.levelEntities.clear();
    addLevelEntity(alpha, {
        id: sourceId,
        name: 'GoblinBoss1Hard',
        isPlayer: false,
        team: 2,
        x: 120,
        y: 220
    });
    setContributors(getClientLevelScope(alpha as never), sourceId, ['epsilon']);

    await withMockedRandom([0.5, 0.0, 0.97, 0.1], async () => {
        await RewardHandler.handleGrantReward(alpha as never, buildGrantRewardPayload(sourceId, {
            dropMaterial: true
        }));
    });
    assert.equal(getMaterialRarity(findLoot(alpha, 'material')?.material ?? 0), 'L', 'hard material rolls should be able to produce legendary material');
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
        await testSimpleLootMinionDoesNotDropGear();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testRandomItemLieutenantUsesItemDropChanceForGear();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testMaterialRequiresExplicitDropFlag();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testGearRarityTracksValueTier();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testMaterialRarityTracksValueTier();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testOwnedGearDoesNotDropAgain();

        console.log('reward_loot_rate_regression: ok');
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
        GlobalState.combatContributions = combatContributions;
    }
}

void main().catch((error) => {
    console.error('reward_loot_rate_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
