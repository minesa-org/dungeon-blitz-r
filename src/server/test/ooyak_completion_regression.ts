import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import { LevelConfig } from '../core/LevelConfig';
import { EntityState, EntityTeam } from '../core/Entity';
import { MissionID } from '../data/runtime';
import { MissionLoader } from '../data/MissionLoader';
import { MissionHandler } from '../handlers/MissionHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    playerSpawned: boolean;
    forcedDungeonCompletionScope: string;
    pendingDungeonCompletionFlushActive?: boolean;
    userId: number | null;
    character: {
        name: string;
        level: number;
        xp: number;
        CurrentLevel: { name: string; x: number; y: number };
        PreviousLevel: { name: string; x: number; y: number };
        missions: Record<string, Record<string, number>>;
        questTrackerState: number;
        lastCompletedDungeonLevel?: string;
    };
    entities: Map<number, unknown>;
    sentPackets: SentPacket[];
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

function ensureDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!LevelConfig.has('SRN_Mission4')) {
        LevelConfig.load(dataDir);
    }
    if (!MissionLoader.getMissionDef(MissionID.SlayOoyak)) {
        MissionLoader.load(dataDir);
    }
    if (!GameData.getEntType('WyrmGreat')) {
        GameData.load(dataDir);
    }
}

function createLevelCompletePacket(progress: number = 100, remainingKills: number = 0, requiredKills: number = 1): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(progress);
    bb.writeMethod9(5000);
    bb.writeMethod9(100);
    bb.writeMethod9(0);
    bb.writeMethod9(0);
    bb.writeMethod9(remainingKills);
    bb.writeMethod9(requiredKills);
    bb.writeMethod9(10);
    return bb.toBuffer();
}

function createOoyakClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    return {
        token: 11251,
        currentLevel: 'SRN_Mission4',
        levelInstanceId: 'ooyak-run',
        currentRoomId: 1,
        playerSpawned: true,
        forcedDungeonCompletionScope: '',
        userId: null,
        character: {
            name: 'Fleerpuh',
            level: 20,
            xp: 0,
            CurrentLevel: { name: 'SRN_Mission4', x: 0, y: 0 },
            PreviousLevel: { name: 'SwampRoadConnection', x: 0, y: 0 },
            missions: {
                [String(MissionID.SlayOoyak)]: {
                    state: 1,
                    currCount: 0
                }
            },
            questTrackerState: 64
        },
        entities: new Map(),
        sentPackets,
        sendBitBuffer(id: number, bb: BitBuffer): void {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

async function testOoyakIgnoresClientCompletionUntilBossDies(): Promise<void> {
    const client = createOoyakClient();
    GlobalState.levelEntities.set('SRN_Mission4#ooyak-run', new Map());

    await MissionHandler.handleSetLevelComplete(client as never, createLevelCompletePacket());

    assert.equal(
        Number(client.character.missions[String(MissionID.SlayOoyak)]?.state ?? 0),
        1,
        'Lair of the Ooyak should remain in progress when the client reports completion before Ooyak dies'
    );
    assert.equal(client.character.questTrackerState, 64);
    assert.equal(client.character.lastCompletedDungeonLevel, undefined);
    assert.equal(client.sentPackets.some((packet) => packet.id === 0x85 || packet.id === 0x86), false);
}

async function testOoyakCompletesAfterBossDeathIsRecorded(): Promise<void> {
    const client = createOoyakClient();
    client.forcedDungeonCompletionScope = 'SRN_Mission4#ooyak-run';
    client.pendingDungeonCompletionFlushActive = true;
    GlobalState.levelEntities.set(
        'SRN_Mission4#ooyak-run',
        new Map([
            [9001, {
                id: 9001,
                name: 'WyrmGreat',
                isPlayer: false,
                team: EntityTeam.ENEMY,
                entState: EntityState.DEAD,
                dead: true,
                hp: 0
            }]
        ])
    );

    await MissionHandler.handleSetLevelComplete(client as never, createLevelCompletePacket());

    assert.equal(
        Number(client.character.missions[String(MissionID.SlayOoyak)]?.state ?? 0),
        2,
        'Lair of the Ooyak should complete after the required Ooyak boss death is recorded'
    );
    assert.equal(client.character.questTrackerState, 100);
    assert.equal(client.character.lastCompletedDungeonLevel, 'SRN_Mission4');
}

async function main(): Promise<void> {
    ensureDataLoaded();
    await testOoyakIgnoresClientCompletionUntilBossDies();
    await testOoyakCompletesAfterBossDeathIsRecorded();
    GlobalState.levelEntities.delete('SRN_Mission4#ooyak-run');
    console.log('ooyak_completion_regression: ok');
}

void main().catch((error) => {
    console.error('ooyak_completion_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
