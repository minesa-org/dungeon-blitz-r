import { strict as assert } from 'assert';
import * as path from 'path';
import { LevelConfig } from '../core/LevelConfig';
import { MissionDialogueLoader } from '../data/MissionDialogueLoader';
import { MissionLoader } from '../data/MissionLoader';
import { NpcDialogueLoader } from '../data/NpcDialogueLoader';
import { NpcLoader } from '../data/NpcLoader';
import { MissionID } from '../data/runtime/MissionID';
import { NpcHandler } from '../handlers/NpcHandler';
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
    startedRoomEvents: Set<string>;
    userId: number | null;
    character: {
        name: string;
        level: number;
        xp: number;
        gold: number;
        CurrentLevel: { name: string; x: number; y: number };
        PreviousLevel: { name: string; x: number; y: number };
        missions: Record<string, Record<string, number>>;
        questTrackerState: number;
        lastCompletedDungeonLevel?: string;
    };
    entities: Map<number, unknown>;
    pendingMissionTurnIns: Set<number>;
    sentPackets: SentPacket[];
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

function loadData(): void {
    const dataDir = path.resolve(__dirname, '../data');
    LevelConfig.load(dataDir);
    MissionLoader.load(dataDir);
    MissionDialogueLoader.load(dataDir);
    NpcDialogueLoader.load(dataDir);
    NpcLoader.load(dataDir);
}

function createNpcTalkPacket(npcId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(npcId);
    return bb.toBuffer();
}

function createFakeClient(): FakeClient {
    const sentPackets: SentPacket[] = [];

    return {
        token: 9104,
        currentLevel: 'ShazariDesert',
        levelInstanceId: '',
        currentRoomId: 0,
        playerSpawned: true,
        startedRoomEvents: new Set<string>(),
        userId: null,
        character: {
            name: 'ShazariRewardTester',
            level: 24,
            xp: 0,
            gold: 0,
            CurrentLevel: { name: 'ShazariDesert', x: 13835, y: 1174 },
            PreviousLevel: { name: 'ShazariDesert', x: 13835, y: 1174 },
            missions: {
                [String(MissionID.BloodAndSand)]: {
                    state: 2,
                    currCount: 1,
                    Tier: 5,
                    highscore: 209,
                    Time: 123456
                }
            },
            questTrackerState: 100,
            lastCompletedDungeonLevel: 'SD_Mission3'
        },
        entities: new Map(),
        pendingMissionTurnIns: new Set<number>(),
        sentPackets,
        sendBitBuffer(id: number, bb: BitBuffer): void {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function assertMissionReward(missionId: MissionID, exp: number, gold: number): void {
    const missionDef = MissionLoader.getMissionDef(missionId);
    assert.ok(missionDef, `mission ${missionId} must load`);
    assert.equal(missionDef.ExpRewardValue, exp, `${missionDef.MissionName} XP reward`);
    assert.equal(missionDef.GoldRewardValue, gold, `${missionDef.MissionName} gold reward`);
}

async function testShazariRewardTables(): Promise<void> {
    const expected: Array<[MissionID, number, number]> = [
        [MissionID.TempleOfShadows, 1747, 1416],
        [MissionID.TravelToTownOne, 349, 283],
        [MissionID.ScarabInvasion, 1747, 1416],
        [MissionID.BloodAndSand, 2029, 1535],
        [MissionID.GoblinDiplomacy, 2029, 1535],
        [MissionID.AncientBurialGrounds, 2353, 1662],
        [MissionID.AttuneTheAnchor, 2353, 1662],
        [MissionID.GoblinMessenger, 2029, 1535],
        [MissionID.GatherScorpionStingers, 1747, 1416],
        [MissionID.DestroyWaspHives, 2029, 1535],
        [MissionID.CollectGoblinCharms, 2029, 1535],
        [MissionID.CollectGiantBracers, 2029, 1535],
        [MissionID.CollectWormGlands, 2353, 1662],
        [MissionID.TempleOfShadowsHard, 15685, 4503],
        [MissionID.TravelToTownOneHard, 3137, 901],
        [MissionID.ScarabInvasionHard, 15685, 4503],
        [MissionID.BloodAndSandHard, 18111, 4851],
        [MissionID.GoblinDiplomacyHard, 18111, 4851],
        [MissionID.AncientBurialGroundsHard, 20898, 5224],
        [MissionID.AttuneTheAnchorHard, 20898, 5224],
        [MissionID.GoblinMessengerHard, 18111, 4851],
        [MissionID.GatherScorpionStingersHard, 15685, 4503],
        [MissionID.DestroyWaspHivesHard, 18111, 4851],
        [MissionID.CollectGoblinCharmsHard, 18111, 4851],
        [MissionID.CollectGiantBracersHard, 18111, 4851],
        [MissionID.CollectWormGlandsHard, 20898, 5224],
        [MissionID.GoSeeGladiator, 406, 307],
        [MissionID.GoSeeGoblin, 406, 307],
        [MissionID.GoSeeGladiatorHard, 406, 307],
        [MissionID.GoSeeGoblinHard, 406, 307],
        [MissionID.SDTales0GetStarted, 1317, 574],
        [MissionID.SDTales1Escort, 6587, 2872],
        [MissionID.SDTales2Surprise, 6587, 2872],
        [MissionID.SDTales3Remodel, 6587, 2872],
        [MissionID.SDTales4Oasis, 6587, 2872],
        [MissionID.SDTales5Defense, 6587, 2872],
        [MissionID.SDTales6Time, 6587, 2872]
    ];

    for (const [missionId, exp, gold] of expected) {
        assertMissionReward(missionId, exp, gold);
    }
}

async function testShazariTurnInGrantsFullReward(): Promise<void> {
    const client = createFakeClient();
    const gladiatorNpcId = 5341065;

    await NpcHandler.handleTalkToNpc(client as never, createNpcTalkPacket(gladiatorNpcId));

    assert.equal(client.character.xp, 2029, 'Blood and Sand turn-in must add full XP reward');
    assert.equal(client.character.gold, 1535, 'Blood and Sand turn-in must add full gold reward');
    assert.equal(
        Number(client.character.missions[String(MissionID.BloodAndSand)]?.state ?? 0),
        3,
        'Blood and Sand must be claimed after reward turn-in'
    );
    assert.equal(client.sentPackets.some((packet) => packet.id === 0x2B), true, 'turn-in must send XP reward packet');
    assert.equal(client.sentPackets.some((packet) => packet.id === 0x35), true, 'turn-in must send gold reward packet');
}

async function main(): Promise<void> {
    loadData();
    await testShazariRewardTables();
    await testShazariTurnInGrantsFullReward();
    console.log('shazari_mission_reward_regression: ok');
}

main().catch((err) => {
    console.error('shazari_mission_reward_regression: failed');
    console.error(err);
    process.exit(1);
});
