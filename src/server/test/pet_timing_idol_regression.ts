import { strict as assert } from 'assert';
import path from 'path';
import { Character } from '../database/Database';
import { JsonAdapter } from '../database/JsonAdapter';
import { PetConfig } from '../core/PetConfig';
import { PetHandler } from '../handlers/PetHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    userId: number;
    character: Character;
    characters: Character[];
    sentPackets: SentPacket[];
    sendBitBuffer(id: number, bb: BitBuffer): void;
};

function createCharacter(): Character {
    return {
        name: 'Neodevil',
        class: 'Paladin',
        gender: 'male',
        level: 20,
        gold: 100000,
        mammothIdols: 10,
        showHigher: false,
        pets: [
            {
                typeID: 1,
                special_id: 10,
                level: 2,
                xp: 0
            }
        ],
        trainingPet: [],
        OwnedEggsID: [1, 5],
        EggHachery: {},
        activeEggCount: 0,
        CurrentLevel: { name: 'CraftTown', x: 360, y: 1460 },
        PreviousLevel: { name: 'NewbieRoad', x: 1421, y: 826 }
    };
}

function createClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    const character = createCharacter();

    return {
        userId: 7,
        character,
        characters: [character],
        sentPackets,
        sendBitBuffer(id: number, bb: BitBuffer): void {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function createTrainPacket(typeId: number, uniqueId: number, nextRank: number, useIdols: boolean): Buffer {
    const bb = new BitBuffer();
    bb.writeMethod6(typeId, 7);
    bb.writeMethod9(uniqueId);
    bb.writeMethod6(nextRank, 6);
    bb.writeMethod15(useIdols);
    return bb.toBuffer();
}

function createEggHatchPacket(slotIndex: number, useIdols: boolean): Buffer {
    const bb = new BitBuffer();
    bb.writeMethod20(4, slotIndex);
    bb.writeMethod15(useIdols);
    return bb.toBuffer();
}

async function withMockedCharacterSave<T>(fn: () => Promise<T>): Promise<T> {
    const originalSaveCharacterSnapshot = JsonAdapter.prototype.saveCharacterSnapshot;
    JsonAdapter.prototype.saveCharacterSnapshot = async function(userId: number, character: Character): Promise<Character[]> {
        assert.equal(userId, 7);
        return [character];
    };

    try {
        return await fn();
    } finally {
        JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
    }
}

async function testPetTrainingCannotBeCollectedBeforeReadyTime(): Promise<void> {
    const client = createClient();

    await withMockedCharacterSave(async () => {
        await PetHandler.handleTrainPet(client as never, createTrainPacket(1, 10, 3, false));
    });

    assert.equal(client.character.gold, 96000, 'training with gold should deduct the gold cost');
    assert.ok(client.sentPackets.some((packet) => packet.id === 0xB4), 'training with gold should refresh the gold UI');
    assert.equal(client.character.pets?.[0]?.level, 2, 'training should not level the pet immediately');
    assert.ok(Number(client.character.trainingPet?.[0]?.trainingTime ?? 0) > Math.floor(Date.now() / 1000));

    await withMockedCharacterSave(async () => {
        await PetHandler.handlePetTrainingCollect(client as never, Buffer.alloc(0));
    });

    assert.equal(client.character.pets?.[0]?.level, 2, 'collect should fail before training is ready');
    assert.equal(Number(client.character.trainingPet?.[0]?.typeID ?? 0), 1, 'training should remain active before ready');

    client.character.trainingPet = [{
        typeID: 1,
        special_id: 10,
        trainingTime: Math.floor(Date.now() / 1000) - 1
    }];

    await withMockedCharacterSave(async () => {
        await PetHandler.handlePetTrainingCollect(client as never, Buffer.alloc(0));
    });

    assert.equal(client.character.pets?.[0]?.level, 3, 'collect should level the pet after training is ready');
    assert.equal(Number(client.character.trainingPet?.[0]?.trainingTime ?? 0), 0, 'completed training should reset');
}

async function testEggHatchCannotBeCollectedBeforeReadyTimeAndRefreshesIdols(): Promise<void> {
    const client = createClient();

    await withMockedCharacterSave(async () => {
        await PetHandler.handleEggHatch(client as never, createEggHatchPacket(1, true));
    });

    assert.equal(client.character.mammothIdols, 7, 'starting hatch with idols should deduct the idol cost');

    const idolUpdatePacket = client.sentPackets.find((packet) => packet.id === 0xA1);
    assert.ok(idolUpdatePacket, 'pet idol spending should refresh the idol UI');
    const idolReader = new BitReader(idolUpdatePacket!.payload);
    assert.equal(idolReader.readMethod4(), 7, 'idol refresh packet should contain the updated idol total');

    const initialPetCount = client.character.pets?.length ?? 0;

    await withMockedCharacterSave(async () => {
        await PetHandler.handleCollectHatchedEgg(client as never, Buffer.alloc(0));
    });

    assert.equal(client.character.pets?.length ?? 0, initialPetCount, 'egg should not hatch before ready time');
    assert.equal(Number(client.character.EggHachery?.EggID ?? 0), 5, 'egg hatchery should remain active before ready');
    assert.deepEqual(client.character.OwnedEggsID, [1, 5], 'owned eggs should remain unchanged before ready');

    client.character.EggHachery = {
        EggID: 5,
        ReadyTime: Math.floor(Date.now() / 1000) - 1,
        slotIndex: 1
    };

    await withMockedCharacterSave(async () => {
        await PetHandler.handleCollectHatchedEgg(client as never, Buffer.alloc(0));
    });

    assert.equal(client.character.pets?.length ?? 0, initialPetCount + 1, 'ready egg should grant a new pet');
    assert.deepEqual(client.character.OwnedEggsID, [1], 'hatched egg should be removed from owned eggs');
    assert.equal(Number(client.character.EggHachery?.EggID ?? 0), 0, 'hatchery should reset after collection');
}

async function main(): Promise<void> {
    PetConfig.load(path.resolve(__dirname, '..', 'data'));
    await testPetTrainingCannotBeCollectedBeforeReadyTime();
    await testEggHatchCannotBeCollectedBeforeReadyTimeAndRefreshesIdols();
    console.log('pet_timing_idol_regression: ok');
}

void main().catch((error) => {
    console.error('pet_timing_idol_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
