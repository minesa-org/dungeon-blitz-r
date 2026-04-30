import { strict as assert } from 'assert';
import * as path from 'path';
import { LevelConfig } from '../core/LevelConfig';
import { MissionLoader } from '../data/MissionLoader';
import { MissionID } from '../data/runtime';
import { LevelHandler } from '../handlers/LevelHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    currentLevel: string;
    currentRoomId: number;
    levelInstanceId: string;
    playerSpawned: boolean;
    mountTransferGraceUntil: number;
    lastDoorId?: number;
    lastDoorTargetLevel?: string;
    character: {
        name: string;
        CurrentLevel: { name: string; x: number; y: number };
        PreviousLevel: { name: string; x: number; y: number };
        missions: Record<string, Record<string, number>>;
        equippedMount?: number;
    };
    sentPackets: SentPacket[];
    armPendingTransferGrace: () => void;
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

function ensureDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!LevelConfig.has('SwampRoadNorth')) {
        LevelConfig.load(dataDir);
    }
    if (!MissionLoader.getMissionDef(MissionID.StopCastout)) {
        MissionLoader.load(dataDir);
    }
}

function createDoorPacket(doorId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(doorId);
    return bb.toBuffer();
}

function readMethod91(br: BitReader): number {
    const prefix = br.readMethod20(3);
    return br.readMethod20((prefix + 1) * 2);
}

function decodeDoorStatePacket(payload: Buffer): { doorId: number; state: number; targetLevel: string; stars: number } {
    const br = new BitReader(payload);
    const doorId = br.readMethod4();
    const state = readMethod91(br);
    const targetLevel = br.readMethod13();
    return {
        doorId,
        state,
        targetLevel,
        stars: state === 3 ? br.readMethod6(4) : 0
    };
}

function decodeDoorTargetPacket(payload: Buffer): { doorId: number; targetLevel: string } {
    const br = new BitReader(payload);
    return {
        doorId: br.readMethod4(),
        targetLevel: br.readMethod13()
    };
}

function createClient(): FakeClient {
    const sentPackets: SentPacket[] = [];

    return {
        currentLevel: 'SwampRoadNorth',
        currentRoomId: 0,
        levelInstanceId: 'swamp-door-regression',
        playerSpawned: true,
        mountTransferGraceUntil: 0,
        character: {
            name: 'SwampDoorTester',
            CurrentLevel: { name: 'SwampRoadNorth', x: 4360, y: 595 },
            PreviousLevel: { name: 'NewbieRoad', x: 20298, y: 639 },
            missions: {
                [String(MissionID.DeliverToSwamp)]: {
                    state: 3,
                    currCount: 1,
                    claimed: 1,
                    complete: 1
                },
                [String(MissionID.StopCastout)]: {
                    state: 1,
                    currCount: 0
                }
            }
        },
        sentPackets,
        armPendingTransferGrace(): void {},
        sendBitBuffer(id: number, bb: BitBuffer): void {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function testSwampRoadNorthOnlyShowsAcceptedDungeonDoors(): void {
    const client = createClient();

    LevelHandler.handleRequestDoorState(client as never, createDoorPacket(101));
    LevelHandler.handleRequestDoorState(client as never, createDoorPacket(102));

    assert.deepEqual(
        client.sentPackets
            .filter((entry) => entry.id === 0x42)
            .map((entry) => decodeDoorStatePacket(entry.payload)),
        [
            { doorId: 101, state: 1, targetLevel: 'SRN_Mission1', stars: 0 },
            { doorId: 102, state: 0, targetLevel: '', stars: 0 }
        ],
        'Black Rose Mire should only mark dungeon doors usable after their quests are accepted'
    );
}

function testCompletedDungeonDoorIncludesStoredStars(): void {
    const client = createClient();
    client.currentLevel = 'NewbieRoad';
    client.character.CurrentLevel = { name: 'NewbieRoad', x: 1421, y: 826 };
    client.character.missions[String(MissionID.DefendTheShip)] = {
        state: 2,
        currCount: 1,
        Tier: 5,
        highscore: 140000,
        Time: 333333
    };

    LevelHandler.handleRequestDoorState(client as never, createDoorPacket(104));

    assert.deepEqual(
        decodeDoorStatePacket(client.sentPackets.find((entry) => entry.id === 0x42)!.payload),
        {
            doorId: 104,
            state: 3,
            targetLevel: 'TutorialBoat',
            stars: 5
        },
        'completed dungeon doors should use mission-repeat state and include stored star count for the door plate'
    );
}

function testLockedSwampDungeonDoorDoesNotTransferPlayer(): void {
    const client = createClient();

    LevelHandler.handleOpenDoor(client as never, createDoorPacket(102));

    assert.equal(
        client.sentPackets.some((entry) => entry.id === 0x2E),
        false,
        'opening a locked Black Rose Mire dungeon door should not transfer the player'
    );
}

function testClearedArachnaeOpensFelbridgeRoadToBlackRoseMireConnector(): void {
    const client = createClient();
    client.currentLevel = 'BridgeTown';
    client.character.CurrentLevel = { name: 'BridgeTown', x: 3944, y: 838 };
    client.character.PreviousLevel = { name: 'SwampRoadConnectionMission', x: 0, y: 0 };
    client.character.missions[String(MissionID.ClearTheBridge)] = {
        state: 2,
        currCount: 1,
        Tier: 8,
        highscore: 160000,
        Time: 444444
    };

    LevelHandler.handleRequestDoorState(client as never, createDoorPacket(1));
    LevelHandler.handleOpenDoor(client as never, createDoorPacket(1));

    assert.deepEqual(
        decodeDoorStatePacket(client.sentPackets.find((entry) => entry.id === 0x42)!.payload),
        {
            doorId: 1,
            state: 1,
            targetLevel: 'SwampRoadConnection',
            stars: 0
        },
        'after Arachnae is cleared, the Felbridge road should open to the Black Rose Mire connector instead of the dungeon'
    );
    assert.deepEqual(
        decodeDoorTargetPacket(client.sentPackets.find((entry) => entry.id === 0x2E)!.payload),
        {
            doorId: 1,
            targetLevel: 'SwampRoadConnection'
        },
        'walking through the Felbridge road after Arachnae should transfer to the connector map'
    );
}

function testUnclearedArachnaeStillUsesFelbridgeDungeonEntrance(): void {
    const client = createClient();
    client.currentLevel = 'BridgeTown';
    client.character.CurrentLevel = { name: 'BridgeTown', x: 3944, y: 838 };
    client.character.missions[String(MissionID.ClearTheBridge)] = {
        state: 1,
        currCount: 0
    };

    LevelHandler.handleRequestDoorState(client as never, createDoorPacket(1));

    assert.deepEqual(
        decodeDoorStatePacket(client.sentPackets.find((entry) => entry.id === 0x42)!.payload),
        {
            doorId: 1,
            state: 1,
            targetLevel: 'SwampRoadConnectionMission',
            stars: 0
        },
        'before Arachnae is cleared, the Felbridge road should still enter the Arachnae dungeon'
    );
}

async function main(): Promise<void> {
    ensureDataLoaded();
    testSwampRoadNorthOnlyShowsAcceptedDungeonDoors();
    testCompletedDungeonDoorIncludesStoredStars();
    testLockedSwampDungeonDoorDoesNotTransferPlayer();
    testClearedArachnaeOpensFelbridgeRoadToBlackRoseMireConnector();
    testUnclearedArachnaeStillUsesFelbridgeDungeonEntrance();
    console.log('swamp_door_mission_regression: ok');
}

void main().catch((error) => {
    console.error('swamp_door_mission_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
