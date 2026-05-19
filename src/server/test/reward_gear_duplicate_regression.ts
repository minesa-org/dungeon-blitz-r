import { strict as assert } from 'assert';
import { GlobalState } from '../core/GlobalState';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { RewardHandler } from '../handlers/RewardHandler';
import { normalizeCharacterInventoryGears } from '../utils/GearInventory';

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
            equippedGears: []
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

function buildPickupPayload(lootId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(lootId);
    return bb.toBuffer();
}

async function testPickupAllowsHigherTierUpgradeForOwnedGear(): Promise<void> {
    const alpha = createFakeClient(2, 'Alpha');
    const gearId = 680;
    alpha.character.inventoryGears = [{ gearID: gearId, tier: 0, runes: [0, 0, 0], colors: [0, 0] }];
    alpha.pendingLoot.set(990002, { gear: gearId, tier: 2 });

    await RewardHandler.handlePickupLootdrop(alpha as never, buildPickupPayload(990002));

    assert.equal(alpha.character.inventoryGears.length, 1, 'higher-tier should upgrade in-place, not add alongside');
    assert.equal(alpha.character.inventoryGears[0]?.gearID, gearId);
    assert.equal(alpha.character.inventoryGears[0]?.tier, 2, 'upgraded entry should have the higher tier');
    assert.equal(alpha.sentPackets.some((packet) => packet.id === 0x33), true, 'higher-tier pickup should emit a gear reward packet');
}

function testInventoryNormalizerRemovesSameTierDuplicates(): void {
    const alpha = createFakeClient(5, 'Alpha');
    alpha.character.inventoryGears = [
        { gearID: 58, tier: 0, runes: [0, 0, 0], colors: [0, 0] },
        { gearID: 58, tier: 0, runes: [91, 0, 0], colors: [0, 0] },
        { gearID: 58, tier: 1, runes: [0, 0, 0], colors: [0, 0] }
    ];

    const normalized = normalizeCharacterInventoryGears(alpha.character);
    assert.equal(normalized.length, 1, 'same gearID should collapse to single highest-tier entry');
    assert.equal(normalized[0]?.gearID, 58);
    assert.equal(normalized[0]?.tier, 1, 'normalizer should keep highest tier');
    assert.deepEqual(normalized[0]?.runes, [91, 0, 0], 'normalizer should transfer modifiers from lower tier if higher has none');
}

async function testPickupSkipsStaleDuplicateGear(): Promise<void> {
    const alpha = createFakeClient(3, 'Alpha');
    const gearId = 1165;
    alpha.character.inventoryGears = [{ gearID: gearId, tier: 1, runes: [0, 0, 0], colors: [0, 0] }];
    alpha.pendingLoot.set(990001, { gear: gearId, tier: 1 });

    await RewardHandler.handlePickupLootdrop(alpha as never, buildPickupPayload(990001));

    assert.equal(alpha.character.inventoryGears.length, 1, 'duplicate pickup should not append another copy');
    assert.equal(alpha.pendingLoot.size, 0, 'picked loot should still be consumed');
    assert.equal(alpha.sentPackets.some((packet) => packet.id === 0x33), false, 'duplicate pickup should not emit a gear reward packet');
}

async function main(): Promise<void> {
    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    const levelEntities = new Map(GlobalState.levelEntities);
    const combatContributions = new Map(GlobalState.combatContributions);

    try {
        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testPickupAllowsHigherTierUpgradeForOwnedGear();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        testInventoryNormalizerRemovesSameTierDuplicates();

        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        GlobalState.combatContributions.clear();
        await testPickupSkipsStaleDuplicateGear();

        console.log('reward_gear_duplicate_regression: ok');
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
        GlobalState.combatContributions = combatContributions;
    }
}

void main().catch((error) => {
    console.error('reward_gear_duplicate_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
