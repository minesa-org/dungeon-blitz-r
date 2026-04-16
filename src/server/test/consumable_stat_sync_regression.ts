import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import { CommandHandler } from '../handlers/CommandHandler';
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
    playerSpawned: boolean;
    clientEntID: number;
    character: any;
    characters: any[];
    authoritativeMaxHp: number;
    authoritativeCurrentHp: number;
    entities: Map<number, any>;
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, payload: BitBuffer) => void;
};

function ensureDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (GameData.CONSUMABLES.length === 0 || GameData.CHARMS.length === 0) {
        GameData.load(dataDir);
    }
}

function createClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    const character: any = {
        name: 'Delta',
        class: 'Mage',
        level: 20,
        activeConsumableID: 0,
        queuedConsumableID: 0,
        CurrentLevel: {
            name: 'CraftTown',
            x: 12,
            y: 24
        },
        consumables: [
            { consumableID: 6, count: 2 }
        ]
    };

    return {
        token: 77,
        userId: null,
        currentLevel: 'CraftTown',
        playerSpawned: true,
        clientEntID: 4001,
        character,
        characters: [character],
        authoritativeMaxHp: 100,
        authoritativeCurrentHp: 100,
        entities: new Map<number, any>([
            [4001, { id: 4001, x: 12, y: 24, activeConsumableId: 0, hp: 100, maxHp: 100 }]
        ]),
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, payload: BitBuffer) {
            sentPackets.push({ id, payload: payload.toBuffer() });
        }
    };
}

function buildQueuePotionPayload(consumableId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod20(5, consumableId);
    return bb.toBuffer();
}

function buildActivatePotionPayload(entityId: number, consumableId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(entityId);
    bb.writeMethod20(5, consumableId);
    return bb.toBuffer();
}

function buildCombatStatsPayload(meleeDamage: number, magicDamage: number, maxHp: number, scale: number, revision: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(meleeDamage);
    bb.writeMethod9(magicDamage);
    bb.writeMethod9(maxHp);
    bb.writeMethod20(4, scale);
    bb.writeMethod9(revision);
    return bb.toBuffer();
}

function parsePotionState(payload: Buffer): { entityId: number; consumableId: number } {
    const br = new BitReader(payload);
    return {
        entityId: br.readMethod4(),
        consumableId: br.readMethod6(5)
    };
}

async function testPotionQueueAndActivationRefreshState(): Promise<void> {
    const client = createClient();
    GlobalState.sessionsByToken.set(client.token, client as never);

    await CommandHandler.handleQueuePotion(client as never, buildQueuePotionPayload(6));
    assert.equal(client.character.queuedConsumableID, 6, 'queue potion should persist the queued consumable');

    await CommandHandler.handleActivatePotion(client as never, buildActivatePotionPayload(4001, 6));

    assert.equal(client.character.activeConsumableID, 6, 'activating potion should persist the active consumable');
    assert.equal(client.entities.get(4001)?.activeConsumableId, 6, 'activating potion should update the live entity state');

    const activePotionPacket = client.sentPackets.find((packet) => packet.id === 0x10D);
    const playerDataRefreshPacket = client.sentPackets.find((packet) => packet.id === 0x10);
    const combatRefreshPacket = client.sentPackets.find((packet) => packet.id === 0xFB);
    assert.ok(activePotionPacket, 'activating potion should broadcast the active consumable packet');
    assert.ok(combatRefreshPacket, 'activating potion should request a combat stat refresh so potion bonuses update immediately');
    assert.equal(playerDataRefreshPacket, undefined, 'activating potion should not resend the full player data packet');
    assert.deepEqual(parsePotionState(activePotionPacket!.payload), {
        entityId: 4001,
        consumableId: 6
    });
}

function testCombatStatSyncUpdatesAuthoritativeHealth(): void {
    const client = createClient();

    CommandHandler.handleSendCombatStats(client as never, buildCombatStatsPayload(123, 234, 9876, 3, 12));

    assert.equal(client.authoritativeMaxHp, 9876, 'combat stat sync should update the server max HP');
    assert.equal(client.authoritativeCurrentHp, 100, 'combat stat sync should clamp current HP against the new max HP');
    assert.equal(client.entities.get(4001)?.maxHp, 9876, 'combat stat sync should refresh the live entity max HP');
  }

async function main(): Promise<void> {
    ensureDataLoaded();
    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    try {
        await testPotionQueueAndActivationRefreshState();
        testCombatStatSyncUpdatesAuthoritativeHealth();
        console.log('consumable_stat_sync_regression: ok');
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
    }
}

void main().catch((error) => {
    console.error('consumable_stat_sync_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
