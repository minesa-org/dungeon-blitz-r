import { strict as assert } from 'assert';
import path from 'path';
import { Character } from '../database/Database';
import { GlobalState } from '../core/GlobalState';
import { LevelConfig } from '../core/LevelConfig';
import { MissionLoader } from '../data/MissionLoader';
import { MissionID } from '../data/runtime';
import { CombatHandler } from '../handlers/CombatHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';

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
    clientEntID: number;
    userId: number | null;
    character: Character;
    characters?: Character[];
    authoritativeMaxHp: number;
    authoritativeCurrentHp: number;
    processedRewardSources: Set<string>;
    pendingLoot: Map<number, unknown>;
    knownEntityIds: Set<number>;
    entities: Map<number, any>;
    sentPackets: SentPacket[];
    send(id: number, payload: Buffer): void;
    sendBitBuffer(id: number, bb: BitBuffer): void;
};

function ensureDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!LevelConfig.has('NewbieRoad')) {
        LevelConfig.load(dataDir);
    }
    if (!MissionLoader.getMissionDef(MissionID.GetGoblinNoserings)) {
        MissionLoader.load(dataDir);
    }
}

function resetGlobalState(): void {
    GlobalState.sessionsByToken.clear();
    GlobalState.sessionsByUserId.clear();
    GlobalState.sessionsByCharacterName.clear();
    GlobalState.partyGroups.clear();
    GlobalState.partyByMember.clear();
    GlobalState.levelEntities.clear();
    GlobalState.levelQuestProgress.clear();
    GlobalState.combatContributions.clear();
    GlobalState.entityLifeNonces.clear();
    GlobalState.entityLastRewardNonces.clear();
}

function createCharacter(missions: Record<string, Record<string, number>>): Character {
    return {
        name: 'QuestKillTester',
        class: 'Paladin',
        gender: 'male',
        level: 3,
        missions,
        questTrackerState: 100,
        CurrentLevel: { name: 'NewbieRoad', x: 0, y: 0 },
        PreviousLevel: { name: 'NewbieRoad', x: 0, y: 0 }
    };
}

function createClient(missions: Record<string, Record<string, number>>): FakeClient {
    const sentPackets: SentPacket[] = [];
    const character = createCharacter(missions);

    return {
        token: 9101,
        currentLevel: 'NewbieRoad',
        levelInstanceId: '',
        currentRoomId: 0,
        playerSpawned: true,
        clientEntID: 40101,
        userId: null,
        character,
        characters: [character],
        authoritativeMaxHp: 100,
        authoritativeCurrentHp: 100,
        processedRewardSources: new Set<string>(),
        pendingLoot: new Map<number, unknown>(),
        knownEntityIds: new Set<number>(),
        entities: new Map<number, any>(),
        sentPackets,
        send(id: number, payload: Buffer): void {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, bb: BitBuffer): void {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function createDestroyEntityPacket(entityId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(entityId);
    bb.writeMethod15(false);
    return bb.toBuffer();
}

function decodeMissionProgressPacket(payload: Buffer): { missionId: number; progress: number } {
    const br = new BitReader(payload);
    return {
        missionId: br.readMethod4(),
        progress: br.readMethod4()
    };
}

function decodeMissionCompletePacket(payload: Buffer): number {
    const br = new BitReader(payload);
    return br.readMethod4();
}

async function destroyEnemy(client: FakeClient, entityId: number, entityName: string): Promise<void> {
    client.entities.set(entityId, {
        id: entityId,
        name: entityName,
        isPlayer: false,
        team: 2
    });
    await CombatHandler.handleEntityDestroy(client as never, createDestroyEntityPacket(entityId));
}

async function testRecoverRingsProgressesOnGoblinBruteKills(): Promise<void> {
    resetGlobalState();
    const client = createClient({
        [String(MissionID.GetGoblinNoserings)]: {
            state: 1,
            currCount: 0
        }
    });

    for (let index = 0; index < 5; index++) {
        await destroyEnemy(client, 5000 + index, 'GoblinBrute');
    }

    assert.equal(
        Number(client.character.missions[String(MissionID.GetGoblinNoserings)]?.currCount ?? 0),
        5,
        'Recover Rings should count each GoblinBrute kill toward the nosering total'
    );
    assert.equal(
        Number(client.character.missions[String(MissionID.GetGoblinNoserings)]?.state ?? 0),
        2,
        'Recover Rings should become ready to turn in after five GoblinBrute kills'
    );

    assert.deepEqual(
        client.sentPackets
            .filter((packet) => packet.id === 0x83)
            .map((packet) => decodeMissionProgressPacket(packet.payload)),
        [
            { missionId: MissionID.GetGoblinNoserings, progress: 1 },
            { missionId: MissionID.GetGoblinNoserings, progress: 1 },
            { missionId: MissionID.GetGoblinNoserings, progress: 1 },
            { missionId: MissionID.GetGoblinNoserings, progress: 1 },
            { missionId: MissionID.GetGoblinNoserings, progress: 1 }
        ],
        'Recover Rings should send delta progress packets because the client adds the value onto the visible counter'
    );
    assert.equal(
        decodeMissionCompletePacket(
            client.sentPackets.find((packet) => packet.id === 0x86)!.payload
        ),
        MissionID.GetGoblinNoserings,
        'Recover Rings should notify the client once the nosering objective is complete'
    );
}

async function testRecoverRingsIgnoresNonBruteGoblinKills(): Promise<void> {
    resetGlobalState();
    const client = createClient({
        [String(MissionID.GetGoblinNoserings)]: {
            state: 1,
            currCount: 0
        }
    });

    await destroyEnemy(client, 6001, 'IntroGoblin');

    assert.equal(
        Number(client.character.missions[String(MissionID.GetGoblinNoserings)]?.currCount ?? 0),
        0,
        'Recover Rings should ignore smaller goblins'
    );
    assert.equal(
        client.sentPackets.some((packet) => packet.id === 0x83 || packet.id === 0x86),
        false,
        'Recover Rings should stay silent when an unrelated goblin dies'
    );
}

async function main(): Promise<void> {
    ensureDataLoaded();
    await testRecoverRingsProgressesOnGoblinBruteKills();
    await testRecoverRingsIgnoresNonBruteGoblinKills();
    console.log('mission_kill_progress_regression: ok');
}

void main().catch((error) => {
    console.error('mission_kill_progress_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
