import { strict as assert } from 'assert';
import path from 'path';
import { Character } from '../database/Database';
import { JsonAdapter } from '../database/JsonAdapter';
import { PetConfig } from '../core/PetConfig';
import { PetHandler } from '../handlers/PetHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

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
        name: 'NeoEgg',
        class: 'Paladin',
        gender: 'male',
        level: 20,
        gold: 100000,
        mammothIdols: 50,
        showHigher: false,
        pets: [],
        trainingPet: [],
        OwnedEggsID: ['1', '5'] as unknown as number[],
        EggHachery: {
            EggID: '5',
            ReadyTime: Math.floor(Date.now() / 1000) + 86400,
            slotIndex: '1'
        },
        activeEggCount: 1,
        EggResetTime: Math.floor(Date.now() / 1000) + 3600,
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

function createEggSpeedupPacket(idolCost: number): Buffer {
    const bb = new BitBuffer();
    bb.writeMethod9(idolCost);
    return bb.toBuffer();
}

async function withMockedCharacterSave<T>(fn: () => Promise<T>): Promise<T> {
    const originalLoadCharacters = JsonAdapter.prototype.loadCharacters;
    const originalSaveCharacters = JsonAdapter.prototype.saveCharacters;
    JsonAdapter.prototype.loadCharacters = async function(userId: number): Promise<Character[]> {
        assert.equal(userId, 7);
        return [createCharacter()];
    };
    JsonAdapter.prototype.saveCharacters = async function(userId: number, characters: Character[]): Promise<void> {
        assert.equal(userId, 7);
        assert.ok(Array.isArray(characters));
    };

    try {
        return await fn();
    } finally {
        JsonAdapter.prototype.loadCharacters = originalLoadCharacters;
        JsonAdapter.prototype.saveCharacters = originalSaveCharacters;
    }
}

async function testEggSpeedupAndCollectAcceptStringBackedIds(): Promise<void> {
    const client = createClient();

    await withMockedCharacterSave(async () => {
        await PetHandler.handleEggSpeedUp(client as never, createEggSpeedupPacket(13));
    });

    assert.equal(client.character.mammothIdols, 37, 'speedup should deduct the idol cost');
    assert.equal(Number(client.character.EggHachery?.ReadyTime ?? -1), 0, 'speedup should mark the egg as ready');
    assert.equal(client.sentPackets.some((packet) => packet.id === 0xE7), true, 'speedup should replay the hatch-start packet');

    await withMockedCharacterSave(async () => {
        await PetHandler.handleCollectHatchedEgg(client as never, Buffer.alloc(0));
    });

    assert.equal(client.character.pets?.length ?? 0, 1, 'collect should grant the hatched pet');
    assert.equal(Number(client.character.pets?.[0]?.typeID ?? 0), 5, 'collect should grant the pet matching the egg ID');
    assert.deepEqual(client.character.OwnedEggsID, [1], 'collect should remove the hatched egg slot');
    assert.equal(Number(client.character.EggHachery?.EggID ?? -1), 0, 'collect should reset the hatchery state');
    assert.equal(client.sentPackets.some((packet) => packet.id === 0x37), true, 'collect should send the new pet reward packet');
    assert.equal(client.sentPackets.some((packet) => packet.id === 0xE5), true, 'collect should refresh hatchery contents');
}

async function main(): Promise<void> {
    PetConfig.load(path.resolve(__dirname, '..', 'data'));
    await testEggSpeedupAndCollectAcceptStringBackedIds();
    console.log('egg_speedup_collect_regression: ok');
}

void main().catch((error) => {
    console.error('egg_speedup_collect_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
