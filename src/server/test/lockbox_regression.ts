import { strict as assert } from 'assert';
import * as path from 'path';
import { GameData } from '../core/GameData';
import { PetConfig } from '../core/PetConfig';
import { LockboxHandler } from '../handlers/LockboxHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    userId: number | null;
    currentLevel: string;
    levelInstanceId: string;
    character: any;
    characters: any[];
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, payload: BitBuffer) => void;
};

function ensureGameDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (GameData.getMountId('MountLockbox01L01') === 0) {
        GameData.load(dataDir);
    }
    if (PetConfig.PET_TYPES.length === 0 || PetConfig.EGG_TYPES.length === 0) {
        PetConfig.load(dataDir);
    }
}

function createFakeClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    return {
        token: 1,
        userId: null,
        currentLevel: 'CraftTown',
        levelInstanceId: '',
        character: {
            name: 'Neodev',
            class: 'Paladin',
            gold: 500000,
            mammothIdols: 1000,
            DragonKeys: 0,
            SilverSigils: 0,
            mounts: [1],
            equippedMount: 1,
            lockboxes: [],
            pets: [],
            inventoryGears: [],
            equippedGears: [],
            OwnedDyes: [],
            charms: [],
            consumables: [],
            CurrentLevel: {
                name: 'CraftTown',
                x: 0,
                y: 0
            }
        },
        characters: [],
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, payload: BitBuffer) {
            sentPackets.push({ id, payload: payload.toBuffer() });
        }
    };
}

function buildBuyTrovePayload(lockboxId: number, optionIndex: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod6(lockboxId, 2);
    bb.writeMethod4(optionIndex);
    return bb.toBuffer();
}

function buildBuyKeysPayload(optionIndex: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(optionIndex);
    return bb.toBuffer();
}

function parseGoldLoss(payload: Buffer): number {
    const br = new BitReader(payload);
    return br.readMethod4();
}

function parseLockboxDelta(payload: Buffer): { lockboxId: number; delta: number; showNotification: boolean } {
    const br = new BitReader(payload);
    return {
        lockboxId: br.readMethod6(2),
        delta: br.readMethod4(),
        showNotification: br.readMethod15()
    };
}

function parseIdolLoss(payload: Buffer): { name: string; amount: number } {
    const br = new BitReader(payload);
    return {
        name: br.readMethod13(),
        amount: br.readMethod4()
    };
}

function parseGoldReward(payload: Buffer): { amount: number; suppress: boolean } {
    const br = new BitReader(payload);
    return {
        amount: br.readMethod4(),
        suppress: br.readMethod15()
    };
}

function parsePetReward(payload: Buffer): { typeId: number; specialId: number; level: number; suppress: boolean } {
    const br = new BitReader(payload);
    return {
        typeId: br.readMethod6(7),
        specialId: br.readMethod4(),
        level: br.readMethod6(6),
        suppress: br.readMethod15()
    };
}

function parseLockboxReveal(payload: Buffer): { packId: number; rewardIndex: number; hasName: number; name: string } {
    const br = new BitReader(payload);
    return {
        packId: br.readMethod6(3),
        rewardIndex: br.readMethod6(6),
        hasName: br.readMethod6(1),
        name: br.readMethod13()
    };
}

function withMockedRandom(values: number[], fn: () => Promise<void> | void): Promise<void> | void {
    const originalRandom = Math.random;
    let index = 0;
    Math.random = () => values[Math.min(index++, values.length - 1)] ?? 0;

    try {
        return fn();
    } finally {
        Math.random = originalRandom;
    }
}

async function testBuyTreasureTroveUpdatesInventoryAndSendsDelta(): Promise<void> {
    const client = createFakeClient();

    await LockboxHandler.handleBuyTreasureTrove(client as never, buildBuyTrovePayload(1, 1));

    assert.equal(client.character.gold, 125000, 'treasure trove purchase should deduct gold');
    assert.deepEqual(client.character.lockboxes, [{ lockboxID: 1, count: 10 }], 'treasure trove purchase should persist the new trove count');

    const goldLossPacket = client.sentPackets.find((packet) => packet.id === 0xB4);
    const lockboxDeltaPacket = client.sentPackets.find((packet) => packet.id === 0x104);
    assert.ok(goldLossPacket, 'treasure trove purchase should notify the gold loss');
    assert.ok(lockboxDeltaPacket, 'treasure trove purchase should send the lockbox delta packet');
    assert.equal(parseGoldLoss(goldLossPacket!.payload), 375000);
    assert.deepEqual(parseLockboxDelta(lockboxDeltaPacket!.payload), {
        lockboxId: 1,
        delta: 10,
        showNotification: true
    });
}

async function testBuyDragonKeysUpdatesAccountState(): Promise<void> {
    const client = createFakeClient();

    await LockboxHandler.handleBuyLockboxKeys(client as never, buildBuyKeysPayload(2));

    assert.equal(client.character.mammothIdols, 530, 'Dragon Key purchase should deduct Mammoth Idols');
    assert.equal(client.character.DragonKeys, 25, 'Dragon Key purchase should add purchased keys');

    const idolLossPacket = client.sentPackets.find((packet) => packet.id === 0xB5);
    assert.ok(idolLossPacket, 'Dragon Key purchase should send the Mammoth Idol deduction packet');
    assert.deepEqual(parseIdolLoss(idolLossPacket!.payload), {
        name: 'DragonKeys_x25',
        amount: 470
    });
}

async function testOpenTreasureTroveConsumesCountsAndGrantsReward(): Promise<void> {
    const client = createFakeClient();
    client.character.gold = 100;
    client.character.DragonKeys = 1;
    client.character.lockboxes = [{ lockboxID: 1, count: 1 }];
    const debugLogs: string[] = [];
    const originalConsoleLog = console.log;

    console.log = (...args: unknown[]) => {
        debugLogs.push(args.map((arg) => String(arg)).join(' '));
    };
    try {
        await withMockedRandom([0.85, 0.5], async () => {
            await LockboxHandler.handleLockboxReward(client as never, Buffer.alloc(0));
        });
    } finally {
        console.log = originalConsoleLog;
    }

    assert.deepEqual(client.character.lockboxes, [], 'opening the final treasure trove should remove the lockbox entry');
    assert.equal(client.character.DragonKeys, 0, 'opening a treasure trove should consume one Dragon Key');
    assert.equal(client.character.gold, 500100, 'gold rewards should be persisted on the character');
    assert.equal(client.character.SilverSigils, 100, 'opening a treasure trove should always award Royal Sigils');

    const revealPacket = client.sentPackets.find((packet) => packet.id === 0x108);
    const sigilPacket = client.sentPackets.find((packet) => packet.id === 0x112);
    const goldRewardPacket = client.sentPackets.find((packet) => packet.id === 0x35);
    const playerDataRefreshPacket = client.sentPackets.find((packet) => packet.id === 0x10);
    assert.ok(revealPacket, 'opening a treasure trove should send the reward reveal packet');
    assert.ok(sigilPacket, 'opening a treasure trove should award Royal Sigils');
    assert.ok(goldRewardPacket, 'gold rewards should emit the gold reward packet');
    assert.equal(playerDataRefreshPacket, undefined, 'opening a treasure trove should not resend the full player data packet');
    assert.deepEqual(parseLockboxReveal(revealPacket!.payload), {
        packId: 1,
        rewardIndex: 17,
        hasName: 1,
        name: '500,000 Gold'
    });
    assert.deepEqual(parseGoldReward(goldRewardPacket!.payload), {
        amount: 500000,
        suppress: false
    });
    assert.equal(
        debugLogs.some((line) =>
            line.includes('[LockboxHandler] Treasure Trove opened by Neodev:') &&
            line.includes('rewardIndex=17') &&
            line.includes('type=gold') &&
            line.includes('rarity=N/A') &&
            line.includes('topRoll=85.000%') &&
            line.includes('topChance=3.000%') &&
            line.includes('topBand=83.000%-86.000%') &&
            line.includes('poolEntries=20') &&
            line.includes('poolWeight=100') &&
            line.includes('remainingTroves=0') &&
            line.includes('remainingKeys=0')
        ),
        true,
        'opening a treasure trove should emit a concise debug summary of the chosen reward and pool'
    );
}

async function testOpenTreasureTroveEggRewardGrantsEligibleLevelTenPet(): Promise<void> {
    const client = createFakeClient();
    client.character.gold = 100;
    client.character.DragonKeys = 1;
    client.character.lockboxes = [{ lockboxID: 1, count: 1 }];
    const expectedEggPets = new Set(
        PetConfig.getHatchablePetsForEggName('GenericBrown').map((pet) => Number(pet?.PetID ?? 0))
    );

    await withMockedRandom([0.02, 0, 0.5], async () => {
        await LockboxHandler.handleLockboxReward(client as never, Buffer.alloc(0));
    });

    assert.equal(client.character.pets.length, 1, 'egg reward should persist the granted pet');
    assert.equal(
        expectedEggPets.has(Number(client.character.pets[0]?.typeID ?? 0)),
        true,
        'egg reward should grant a pet that can hatch from the selected egg pool'
    );
    assert.equal(client.character.pets[0]?.level, 10, 'egg reward pets should start at level 10');

    const revealPacket = client.sentPackets.find((packet) => packet.id === 0x108);
    const petPacket = client.sentPackets.find((packet) => packet.id === 0x37);
    assert.ok(revealPacket, 'egg reward should send a reveal packet');
    assert.ok(petPacket, 'egg reward should send the new pet reward packet');

    const revealedName = parseLockboxReveal(revealPacket!.payload).name;
    const petReward = parsePetReward(petPacket!.payload);
    const revealedPetDef = PetConfig.getPetDef(petReward.typeId);
    assert.equal(revealedName, String(revealedPetDef?.PetName ?? ''), 'reveal packet should name the granted pet');
    assert.deepEqual(petReward, {
        typeId: Number(client.character.pets[0]?.typeID ?? 0),
        specialId: 1,
        level: 10,
        suppress: false
    });
}

async function main(): Promise<void> {
    ensureGameDataLoaded();
    await testBuyTreasureTroveUpdatesInventoryAndSendsDelta();
    await testBuyDragonKeysUpdatesAccountState();
    await testOpenTreasureTroveConsumesCountsAndGrantsReward();
    await testOpenTreasureTroveEggRewardGrantsEligibleLevelTenPet();
    console.log('lockbox_regression: ok');
}

void main().catch((error) => {
    console.error('lockbox_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
