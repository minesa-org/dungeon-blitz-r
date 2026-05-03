import { strict as assert } from 'assert';
import { CommandHandler } from '../handlers/CommandHandler';
import { JsonAdapter } from '../database/JsonAdapter';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';
import { readSavedKeyBindingsPacket, writeSavedKeyBindings } from '../utils/KeyBindings';

function createKeyBindingPacket(entries: Array<number | null>, hasCustom = true): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod15(hasCustom);
    if (hasCustom) {
        for (let index = 0; index < 26; index++) {
            const keyCode = entries[index] ?? null;
            bb.writeMethod15(keyCode !== null);
            if (keyCode !== null) {
                bb.writeMethod393(keyCode);
            }
        }
    }
    return bb.toBuffer();
}

async function withMockedCharacterSave<T>(fn: (saved: { characters: any[] | null }) => Promise<T>): Promise<T> {
    const originalSaveCharacters = JsonAdapter.prototype.saveCharacters;
    const saved = { characters: null as any[] | null };
    JsonAdapter.prototype.saveCharacters = async function(_userId: number, characters: any[]): Promise<void> {
        saved.characters = characters;
    };

    try {
        return await fn(saved);
    } finally {
        JsonAdapter.prototype.saveCharacters = originalSaveCharacters;
    }
}

async function testKeyBindingSavePersistsOverrides(): Promise<void> {
    await withMockedCharacterSave(async (saved) => {
        const character: any = { name: 'KeyHero', class: 'mage', gender: 'male', level: 1 };
        const client: any = {
            userId: 77,
            character,
            characters: [character]
        };
        const entries = new Array(26).fill(null);
        entries[0] = 65;
        entries[3] = 255;

        await CommandHandler.handleKeyBindingSave(client, createKeyBindingPacket(entries));

        assert.equal(client.character.keyBindings[0], 65);
        assert.equal(client.character.keyBindings[3], 255);
        assert.equal(client.character.keyBindings[1], null);
        assert.equal(saved.characters?.[0].keyBindings[0], 65);
        assert.equal(saved.characters?.[0].keyBindings[3], 255);
    });
}

async function testDefaultKeyBindingSaveClearsOverrides(): Promise<void> {
    await withMockedCharacterSave(async (saved) => {
        const character: any = {
            name: 'KeyHero',
            class: 'mage',
            gender: 'male',
            level: 1,
            keyBindings: [65]
        };
        const client: any = {
            userId: 78,
            character,
            characters: [character]
        };

        await CommandHandler.handleKeyBindingSave(client, createKeyBindingPacket([], false));

        assert.equal(Object.prototype.hasOwnProperty.call(client.character, 'keyBindings'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(saved.characters?.[0] ?? {}, 'keyBindings'), false);
    });
}

async function testLinkUpdaterRouteCanPersistKeyBindingPacket(): Promise<void> {
    await withMockedCharacterSave(async (saved) => {
        const character: any = { name: 'KeyHero', class: 'mage', gender: 'male', level: 1 };
        const client: any = {
            userId: 79,
            character,
            characters: [character]
        };
        const entries = new Array(26).fill(null);
        entries[10] = 78;

        await CommandHandler.handleLinkUpdater(client, createKeyBindingPacket(entries));

        assert.equal(client.character.keyBindings[10], 78);
        assert.equal(saved.characters?.[0].keyBindings[10], 78);
    });
}

function testKeyBindingWorldEnterSerialization(): void {
    const bb = new BitBuffer(false);
    const bindings = new Array(26).fill(null);
    bindings[0] = 65;
    bindings[3] = 255;

    writeSavedKeyBindings(bb, bindings);

    const br = new BitReader(bb.toBuffer());
    assert.equal(br.readMethod15(), true);
    assert.equal(br.readMethod15(), true);
    assert.equal(br.readMethod393(), 65);
    assert.equal(br.readMethod15(), false);
    assert.equal(br.readMethod15(), false);
    assert.equal(br.readMethod15(), true);
    assert.equal(br.readMethod393(), 255);
}

function testMalformedKeyBindingPacketIsRejected(): void {
    assert.equal(readSavedKeyBindingsPacket(Buffer.from([0xff, 0xff, 0xff, 0xff])), null);
    assert.equal(readSavedKeyBindingsPacket(Buffer.from([0x00, 0x00])), null);
}

async function main(): Promise<void> {
    await testKeyBindingSavePersistsOverrides();
    await testDefaultKeyBindingSaveClearsOverrides();
    await testLinkUpdaterRouteCanPersistKeyBindingPacket();
    testKeyBindingWorldEnterSerialization();
    testMalformedKeyBindingPacketIsRejected();
    console.log('keybinding_persistence_regression: ok');
}

main().catch((error) => {
    console.error('keybinding_persistence_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
