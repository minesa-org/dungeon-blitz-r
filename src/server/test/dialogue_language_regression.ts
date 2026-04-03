import { strict as assert } from 'assert';
import { Character } from '../database/Database';
import { SocialHandler } from '../handlers/SocialHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    userId: number | null;
    character: Character;
    characters: Character[];
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

function createFakeClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    const character: Character = {
        name: 'LanguageTester',
        class: 'Paladin',
        gender: 'male',
        level: 1,
        dialogueLanguage: 'en'
    };

    return {
        userId: null,
        character,
        characters: [character],
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, bb: BitBuffer) {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function createPublicChatPacket(message: string): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(0);
    bb.writeMethod13(message);
    return bb.toBuffer();
}

function decodeChatStatus(payload: Buffer): string {
    const br = new BitReader(payload);
    return br.readMethod13();
}

async function testLanguageCommandSwitchesToTurkishWithoutBroadcasting(): Promise<void> {
    const client = createFakeClient();

    await SocialHandler.handlePublicChat(client as never, createPublicChatPacket('/lang:tr'));

    assert.equal(client.character.dialogueLanguage, 'tr');
    assert.equal(client.sentPackets.some((packet) => packet.id === 0x2c), false);

    const statusPacket = client.sentPackets.find((packet) => packet.id === 0x44);
    assert.ok(statusPacket, 'language command should send a local status message');
    assert.equal(
        decodeChatStatus(statusPacket!.payload),
        'NPC dialog dili Turkce olarak ayarlandi.'
    );
}

async function testLanguageCommandSwitchesBackToEnglish(): Promise<void> {
    const client = createFakeClient();
    client.character.dialogueLanguage = 'tr';

    await SocialHandler.handlePublicChat(client as never, createPublicChatPacket('/lang:en'));

    assert.equal(client.character.dialogueLanguage, 'en');

    const statusPacket = client.sentPackets.find((packet) => packet.id === 0x44);
    assert.ok(statusPacket, 'language command should acknowledge the language switch');
    assert.equal(
        decodeChatStatus(statusPacket!.payload),
        'NPC dialog language set to English.'
    );
}

async function main(): Promise<void> {
    await testLanguageCommandSwitchesToTurkishWithoutBroadcasting();
    await testLanguageCommandSwitchesBackToEnglish();
    console.log('dialogue_language_regression: ok');
}

void main().catch((error) => {
    console.error('dialogue_language_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
