import { strict as assert } from 'assert';
import * as path from 'path';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';
import { MissionLoader } from '../data/MissionLoader';
import { MissionHandler } from '../handlers/MissionHandler';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    userId: number | null;
    currentLevel: string;
    character: any;
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, payload: BitBuffer) => void;
};

function createFakeClient(): FakeClient {
    const sentPackets: SentPacket[] = [];

    return {
        token: 4444,
        userId: null,
        currentLevel: 'NewbieRoad',
        character: {
            name: 'BadgeHero',
            class: 'paladin',
            gender: 'male',
            headSet: 'head1',
            hairSet: 'hair1',
            mouthSet: 'mouth1',
            faceSet: 'face1',
            hairColor: 0,
            skinColor: 0,
            shirtColor: 0,
            pantColor: 0,
            level: 10,
            xp: 0,
            gold: 0,
            craftXP: 0,
            DragonOre: 0,
            mammothIdols: 0,
            CurrentLevel: {
                name: 'NewbieRoad',
                x: 10,
                y: 20
            },
            missions: {}
        },
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, payload: BitBuffer) {
            sentPackets.push({ id, payload: payload.toBuffer() });
        }
    };
}

function buildBadgeRequestPayload(badgeKey: string): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod26(badgeKey);
    return bb.toBuffer();
}

function readMammothIdolsFromPlayerData(payload: Buffer): number {
    const br = new BitReader(payload);
    br.readMethod4(); // transferToken
    br.readMethod4(); // now
    br.readMethod6(2); // hpScaling
    br.readMethod4(); // bonusLevels

    br.readMethod13(); // name
    br.readMethod15(); // bool
    br.readMethod13(); // class
    br.readMethod13(); // gender
    br.readMethod13(); // head
    br.readMethod13(); // hair
    br.readMethod13(); // mouth
    br.readMethod13(); // face
    br.readMethod20(24); // hairColor
    br.readMethod20(24); // skinColor
    br.readMethod20(24); // shirtColor
    br.readMethod20(24); // pantColor

    for (let i = 0; i < 6; i++) {
        const hasGear = br.readMethod15();
        if (!hasGear) {
            continue;
        }

        br.readMethod20(11); // gearId
        br.readMethod20(2); // tier
        br.readMethod20(16); // rune1
        br.readMethod20(16); // rune2
        br.readMethod20(16); // rune3
        br.readMethod20(8); // color1
        br.readMethod20(8); // color2
    }

    br.readMethod6(6); // level
    br.readMethod4(); // xp
    br.readMethod4(); // gold
    br.readMethod4(); // craftXP
    br.readMethod4(); // DragonOre
    return br.readMethod4();
}

async function main(): Promise<void> {
    MissionLoader.load(path.join(__dirname, '..', 'data'));

    const client = createFakeClient();
    await MissionHandler.handleBadgeRequest(client as never, buildBadgeRequestPayload('KingOfTheWorld'));

    assert.equal(client.character.mammothIdols, 10, 'achievement claim should grant 10 mammoth idols');

    const missionProgressPacket = client.sentPackets.find((packet) => packet.id === 0x83);
    assert.ok(missionProgressPacket, 'mission progress packet should be sent');

    const achievementUiPacket = client.sentPackets.find((packet) => packet.id === 0x84);
    assert.ok(achievementUiPacket, 'achievement complete UI packet should be sent');

    const playerDataPacket = client.sentPackets.find((packet) => packet.id === 0x10);
    assert.ok(playerDataPacket, 'player data refresh packet should be sent');
    assert.equal(
        readMammothIdolsFromPlayerData(playerDataPacket!.payload),
        10,
        'live player data refresh should contain updated mammoth idols'
    );

    console.log('achievement_badge_reward_regression: ok');
}

main().catch((error) => {
    console.error('achievement_badge_reward_regression: failed');
    console.error(error);
    process.exit(1);
});
