import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import {
    finalizeDungeonRun,
    noteDungeonRunCast,
    noteDungeonRunChestOpened,
    noteDungeonRunDeath,
    noteDungeonRunEntitySeen,
    noteDungeonRunHit,
    noteDungeonRunKill,
    syncClientDungeonRunState
} from '../core/DungeonRunStats';
import { LevelConfig } from '../core/LevelConfig';
import { getClientLevelScope } from '../core/LevelScope';
import { NpcLoader } from '../data/NpcLoader';
import { MissionID } from '../data/runtime';
import { MissionHandler } from '../handlers/MissionHandler';
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
    levelInstanceId: string;
    currentRoomId: number;
    playerSpawned: boolean;
    clientEntID: number;
    character: {
        name: string;
        level: number;
        CurrentLevel: { name: string; x: number; y: number };
        PreviousLevel: { name: string; x: number; y: number };
        missions: Record<string, any>;
        questTrackerState: number;
    };
    entities: Map<number, any>;
    pendingLoot: Map<number, any>;
    processedRewardSources: Set<string>;
    sentPackets: SentPacket[];
    dungeonRun: any;
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

function ensureGameDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!LevelConfig.has('TutorialDungeon')) {
        LevelConfig.load(dataDir);
    }
    if (!GameData.getEntType('TreasureChestEmpty')) {
        GameData.load(dataDir);
    }
    if (NpcLoader.getRawNpcsForLevel('TutorialDungeon').length === 0) {
        NpcLoader.load(dataDir);
    }
}

function createFakeClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    return {
        token: 9100,
        userId: null,
        currentLevel: 'TutorialDungeon',
        levelInstanceId: 'tracker-run',
        currentRoomId: 0,
        playerSpawned: true,
        clientEntID: 777,
        character: {
            name: 'TrackerRunner',
            level: 5,
            CurrentLevel: { name: 'TutorialDungeon', x: 0, y: 0 },
            PreviousLevel: { name: 'NewbieRoad', x: 1421, y: 826 },
            missions: {
                [String(MissionID.RescueAnna)]: {
                    state: 1,
                    currCount: 0
                }
            },
            questTrackerState: 0
        },
        entities: new Map<number, any>(),
        pendingLoot: new Map<number, any>(),
        processedRewardSources: new Set<string>(),
        sentPackets,
        dungeonRun: null,
        sendBitBuffer(id: number, bb: BitBuffer) {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

function createLevelCompletePacket(): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(100);
    bb.writeMethod9(0);
    bb.writeMethod9(0);
    bb.writeMethod9(0);
    bb.writeMethod9(0);
    bb.writeMethod9(1);
    bb.writeMethod9(2);
    bb.writeMethod9(3);
    return bb.toBuffer();
}

function decodeDungeonCompletePacket(payload: Buffer): {
    stars: number;
    resultBar: number;
    rank: number;
    kills: number;
    accuracy: number;
    deaths: number;
    treasure: number;
    timeBonus: number;
} {
    const br = new BitReader(payload);
    return {
        stars: br.readMethod6(4),
        resultBar: br.readMethod4(),
        rank: br.readMethod4(),
        kills: br.readMethod4(),
        accuracy: br.readMethod4(),
        deaths: br.readMethod4(),
        treasure: br.readMethod4(),
        timeBonus: br.readMethod4()
    };
}

async function testDungeonCompletionUsesTrackerBuckets(): Promise<void> {
    const client = createFakeClient();
    const levelScope = getClientLevelScope(client as never);
    const minion = { id: 90001, name: 'GoblinClub', team: 2, entRank: 'Minion', hp: 10 };
    const boss = { id: 90002, name: 'GoblinBoss2', team: 2, entRank: 'Boss', hp: 10 };
    const chest = { id: 90003, name: 'TreasureChestEmpty', team: 2, hp: 1 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    client.dungeonRun.eligibleEnemyIds = new Set<number>();
    client.dungeonRun.killedEnemyIds = new Set<number>();
    client.dungeonRun.bossEnemyIds = new Set<number>();
    client.dungeonRun.eligibleChestIds = new Set<number>();
    client.dungeonRun.openedChestIds = new Set<number>();
    noteDungeonRunEntitySeen(client as never, minion.id, minion);
    noteDungeonRunEntitySeen(client as never, boss.id, boss);
    noteDungeonRunEntitySeen(client as never, chest.id, chest);

    noteDungeonRunCast(client as never, {
        sourceId: client.clientEntID,
        projectileId: null,
        isPersistent: false
    });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: boss.id,
        targetEntity: boss,
        damage: 25
    });
    noteDungeonRunCast(client as never, {
        sourceId: client.clientEntID,
        projectileId: null,
        isPersistent: false
    });
    noteDungeonRunChestOpened(client as never, chest.id, chest);
    noteDungeonRunDeath(client as never);
    noteDungeonRunDeath(client as never);
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const finalized = finalizeDungeonRun(client as never, 'success', {
        completionPercent: 100,
        dungeonCompleted: true
    });
    const finalizedAgain = finalizeDungeonRun(client as never, 'success', {
        completionPercent: 100,
        dungeonCompleted: true
    });

    assert.ok(finalized, 'tracker should finalize for the active dungeon run');
    assert.equal(finalized?.runEndTime, finalizedAgain?.runEndTime, 'finalize should be idempotent');
    assert.equal(finalized?.totalEnemiesEligible >= 2, true, 'eligible enemy count should include seen enemies');
    assert.equal(finalized?.killedEnemies >= 1, true, 'killed enemy count should reflect actual kills only');
    assert.equal(finalized?.skippedEnemies >= 1, true, 'skipped enemies should remain when the player rushes the boss');
    assert.equal(finalized?.openedChests >= 1, true, 'opened chests should only count actually opened treasure');
    assert.equal(finalized?.totalShots, 2, 'total shots should come from direct player casts');
    assert.equal(finalized?.successfulHits, 1, 'successful hits should resolve from real combat hits');
    assert.equal(finalized?.missedShots, 1, 'unresolved casts should finalize as misses');
    assert.equal(finalized?.playerDeaths, 2, 'death count should survive revives and completion');
    assert.equal(finalized?.bossKilled, true, 'boss kill should be tracked independently from skipped enemies');

    await MissionHandler.handleSetLevelComplete(client as never, createLevelCompletePacket());

    const resultPacket = client.sentPackets.find((packet) => packet.id === 0x87);
    assert.ok(resultPacket, 'dungeon completion should still send the result screen packet');

    const result = decodeDungeonCompletePacket(resultPacket!.payload);
    assert.equal(result.resultBar, 2, 'Goblin Kidnappers should use its calibrated result bar profile');
    assert.equal(result.kills, 40000, 'kill score should use killed/eligible enemy ratio from the tracker');
    assert.equal(result.accuracy, 20000, 'accuracy score should use tracker hit ratio');
    assert.equal(result.deaths, 20000, 'death score should be based on tracked player deaths');
    assert.equal(result.treasure, 20000, 'treasure score should use opened/eligible chest ratio');
    assert.equal(result.timeBonus >= 0, true, 'time bonus should still be emitted');
}

async function main(): Promise<void> {
    ensureGameDataLoaded();

    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    GlobalState.sessionsByToken.clear();

    try {
        await testDungeonCompletionUsesTrackerBuckets();
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
    }

    console.log('dungeon_run_tracker_regression: ok');
}

void main().catch((error) => {
    console.error('dungeon_run_tracker_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
