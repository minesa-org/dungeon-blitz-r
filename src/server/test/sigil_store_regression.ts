import { strict as assert } from 'assert';
import * as path from 'path';
import { GameData } from '../core/GameData';
import { PetConfig } from '../core/PetConfig';
import { SigilHandler } from '../handlers/SigilHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    userId: number | null;
    character: any;
    characters: any[];
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, payload: BitBuffer) => void;
};

function ensureGameDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (GameData.getMountId('MountLockbox01R01') === 0) {
        GameData.load(dataDir);
    }
    if (PetConfig.PET_TYPES.length === 0) {
        PetConfig.load(dataDir);
    }
}

function createFakeClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    return {
        userId: null,
        character: {
            name: 'SigilBuyer',
            class: 'Mage',
            gold: 500000,
            mammothIdols: 0,
            DragonKeys: 0,
            SilverSigils: 5000,
            mounts: [],
            pets: [],
            inventoryGears: [],
            equippedGears: [],
            OwnedDyes: [],
            charms: [],
            consumables: []
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

function buildPurchasePayload(itemId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod20(5, itemId);
    return bb.toBuffer();
}

function parseMethod4(payload: Buffer): number {
    const br = new BitReader(payload);
    return br.readMethod4();
}

function parseMountReward(payload: Buffer): { mountId: number; suppress: boolean } {
    const br = new BitReader(payload);
    return {
        mountId: br.readMethod4(),
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

function parseConsumableUpdate(payload: Buffer): { consumableId: number; total: number } {
    const br = new BitReader(payload);
    return {
        consumableId: br.readMethod6(5),
        total: br.readMethod4()
    };
}

function parseConsumableReward(payload: Buffer): { consumableId: number; amount: number; suppress: boolean } {
    const br = new BitReader(payload);
    return {
        consumableId: br.readMethod6(5),
        amount: br.readMethod4(),
        suppress: br.readMethod15()
    };
}

function parseCharmReward(payload: Buffer): { charmId: number; suppress: boolean } {
    const br = new BitReader(payload);
    return {
        charmId: br.readMethod6(16),
        suppress: br.readMethod15()
    };
}

async function testPetPurchaseDeductsSigilsAndGrantsPet(): Promise<void> {
    const client = createFakeClient();
    const petDef = PetConfig.PET_TYPES.find((pet) => String(pet?.PetName ?? '') === 'Lockbox01RRed');
    assert.ok(petDef, 'pet config should include the sigil store pet');

    await SigilHandler.handleRoyalSigilStorePurchase(client as never, buildPurchasePayload(4));

    assert.equal(client.character.SilverSigils, 4680, 'pet purchase should deduct sigils');
    assert.equal(client.character.pets.length, 1, 'pet purchase should persist the new pet');
    assert.deepEqual(client.character.pets[0], {
        typeID: Number(petDef!.PetID),
        special_id: 1,
        level: 1,
        xp: 0
    });

    const sigilPacket = client.sentPackets.find((packet) => packet.id === 0x10F);
    const petPacket = client.sentPackets.find((packet) => packet.id === 0x37);
    assert.ok(sigilPacket, 'pet purchase should notify the sigil deduction');
    assert.ok(petPacket, 'pet purchase should send the new pet reward packet');
    assert.equal(parseMethod4(sigilPacket!.payload), 320);
    assert.deepEqual(parsePetReward(petPacket!.payload), {
        typeId: Number(petDef!.PetID),
        specialId: 1,
        level: 1,
        suppress: false
    });
}

async function testConsumablePurchaseStacksAndSendsRewardPackets(): Promise<void> {
    const client = createFakeClient();
    const consumableId = GameData.getConsumableId('GoldFindRegular');
    assert.ok(consumableId > 0, 'consumable data should include GoldFindRegular');
    client.character.consumables.push({ consumableID: consumableId, count: 4 });

    await SigilHandler.handleRoyalSigilStorePurchase(client as never, buildPurchasePayload(11));

    assert.equal(client.character.SilverSigils, 4984, 'consumable purchase should deduct sigils');
    assert.deepEqual(client.character.consumables, [{ consumableID: consumableId, count: 7 }]);

    const updatePacket = client.sentPackets.find((packet) => packet.id === 0x10C);
    const rewardPacket = client.sentPackets.find((packet) => packet.id === 0x10B);
    assert.ok(updatePacket, 'consumable purchase should send an inventory update');
    assert.ok(rewardPacket, 'consumable purchase should send a reward popup packet');
    assert.deepEqual(parseConsumableUpdate(updatePacket!.payload), {
        consumableId,
        total: 7
    });
    assert.deepEqual(parseConsumableReward(rewardPacket!.payload), {
        consumableId,
        amount: 15000,
        suppress: false
    });
}

async function testMountAndCharmPurchasesUseExpectedRewards(): Promise<void> {
    const mountClient = createFakeClient();
    const mountId = GameData.getMountId('MountLockbox01R01');
    assert.ok(mountId > 0, 'mount data should include MountLockbox01R01');

    await SigilHandler.handleRoyalSigilStorePurchase(mountClient as never, buildPurchasePayload(2));

    assert.equal(mountClient.character.SilverSigils, 4360, 'mount purchase should deduct sigils');
    assert.deepEqual(mountClient.character.mounts, [mountId], 'mount purchase should persist the mount');

    const mountPacket = mountClient.sentPackets.find((packet) => packet.id === 0x36);
    assert.ok(mountPacket, 'mount purchase should send the mount reward packet');
    assert.deepEqual(parseMountReward(mountPacket!.payload), {
        mountId,
        suppress: false
    });

    const charmClient = createFakeClient();
    const charmId = GameData.getCharmId('RespecStone');
    assert.ok(charmId > 0, 'charm data should include RespecStone');

    await SigilHandler.handleRoyalSigilStorePurchase(charmClient as never, buildPurchasePayload(8));

    assert.equal(charmClient.character.SilverSigils, 4680, 'respec stone purchase should deduct sigils');
    assert.deepEqual(charmClient.character.charms, [{ charmID: charmId, count: 1 }], 'respec stone purchase should persist the charm item');

    const charmPacket = charmClient.sentPackets.find((packet) => packet.id === 0x109);
    assert.ok(charmPacket, 'respec stone purchase should send the charm reward packet');
    assert.deepEqual(parseCharmReward(charmPacket!.payload), {
        charmId,
        suppress: false
    });
}

async function main(): Promise<void> {
    ensureGameDataLoaded();
    await testPetPurchaseDeductsSigilsAndGrantsPet();
    await testConsumablePurchaseStacksAndSendsRewardPackets();
    await testMountAndCharmPurchasesUseExpectedRewards();
    console.log('sigil_store_regression: ok');
}

void main().catch((error) => {
    console.error('sigil_store_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
