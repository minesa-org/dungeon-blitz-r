import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import {
    noteDungeonRunBossCutscene,
    noteDungeonRunCast,
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

const LIVE_ACCURACY_CAP = 40_000;
const LIVE_DEATHS_BASE = 40_000;
const LIVE_BOSS_RUN_KILL_CAP = 160_000;

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

function createFakeDungeonClient(levelName: string, missionId: MissionID): FakeClient {
    const client = createFakeClient();
    client.currentLevel = levelName;
    client.levelInstanceId = `${levelName}-tracker-run`;
    client.character.CurrentLevel = { name: levelName, x: 0, y: 0 };
    client.character.missions = {
        [String(missionId)]: {
            state: 1,
            currCount: 0
        }
    };
    return client;
}

function resetTrackerEntityBuckets(client: FakeClient): void {
    client.dungeonRun.entryAccumulator.eligibleEnemyIds = new Set<number>();
    client.dungeonRun.entryAccumulator.killedEnemyIds = new Set<number>();
    client.dungeonRun.entryAccumulator.bossEnemyIds = new Set<number>();
    client.dungeonRun.entryAccumulator.eligibleChestIds = new Set<number>();
    client.dungeonRun.entryAccumulator.openedChestIds = new Set<number>();
    client.dungeonRun.entryAccumulator.eligibleObjectiveIds = new Set<number>();
    client.dungeonRun.entryAccumulator.completedObjectiveIds = new Set<number>();
    client.dungeonRun.entryAccumulator.failedObjectiveIds = new Set<number>();
    client.dungeonRun.entryAccumulator.totalEnemiesEligible = 0;
    client.dungeonRun.entryAccumulator.killedEnemies = 0;
    client.dungeonRun.entryAccumulator.skippedEnemies = 0;
    client.dungeonRun.entryAccumulator.totalChestsEligible = 0;
    client.dungeonRun.entryAccumulator.openedChests = 0;
    client.dungeonRun.entryAccumulator.totalObjectivesEligible = 0;
    client.dungeonRun.entryAccumulator.completedObjectives = 0;
    client.dungeonRun.entryAccumulator.failedObjectives = 0;
    client.dungeonRun.entryAccumulator.playerDeaths = 0;
    client.dungeonRun.windowAccumulator = {
        ...client.dungeonRun.windowAccumulator,
        eligibleEnemyIds: new Set<number>(),
        killedEnemyIds: new Set<number>(),
        bossEnemyIds: new Set<number>(),
        eligibleChestIds: new Set<number>(),
        openedChestIds: new Set<number>(),
        eligibleObjectiveIds: new Set<number>(),
        completedObjectiveIds: new Set<number>(),
        failedObjectiveIds: new Set<number>(),
        totalEnemiesEligible: 0,
        killedEnemies: 0,
        skippedEnemies: 0,
        totalChestsEligible: 0,
        openedChests: 0,
        totalObjectivesEligible: 0,
        completedObjectives: 0,
        failedObjectives: 0,
        playerDeaths: 0,
        treasureGold: 0
    };
    client.dungeonRun.totalShots = 0;
    client.dungeonRun.successfulHits = 0;
    client.dungeonRun.missedShots = 0;
    client.dungeonRun.pendingShots = new Map();
    client.dungeonRun.nextShotSequence = 0;
    client.dungeonRun.accuracyRatio = 0;
    client.dungeonRun.accuracyWindowActive = false;
    client.dungeonRun.accuracyWindowSource = 'none';
}

function triggerBossCutscene(client: FakeClient, boss: any): void {
    client.entities.set(boss.id, { ...boss, roomId: client.currentRoomId });
    noteDungeonRunBossCutscene(getClientLevelScope(client as never), client.currentRoomId, boss.id);
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

function assertResultMatchesTrackerSummary(client: FakeClient, result: ReturnType<typeof decodeDungeonCompletePacket>): void {
    const summary = client.dungeonRun.finalizedStats?.scoreSummary;
    assert.ok(summary, 'finalized tracker should expose a score summary');
    assert.equal(result.kills, summary!.finalStat.kills, 'result kill score should come from the tracker summary');
    assert.equal(result.accuracy, summary!.finalStat.accuracy, 'result accuracy should come from the tracker summary');
    assert.equal(result.deaths, summary!.finalStat.deaths, 'result death score should come from the tracker summary');
    assert.equal(result.treasure, summary!.finalStat.treasure, 'result treasure should come from the tracker summary');
    assert.equal(result.timeBonus, summary!.finalStat.timeBonus, 'result time bonus should come from the tracker summary');
}

function getDeathPenaltyPerDeath(levelName: string, deathIndex: number): number {
    const spec = LevelConfig.get(levelName);
    const levelTier = Math.max(1, Number(spec.baseId || 1));
    const difficultyScalar = (spec.isHard ? 1.35 : 1) * (1 + ((levelTier - 1) * 0.08));
    const streakScalar = 1 + (Math.max(1, deathIndex) - 1) * 0.2;
    return Math.max(1, Math.round((4_000 + (levelTier * 750)) * difficultyScalar * streakScalar));
}

function getExpectedDeathScore(levelName: string, deathCount: number): number {
    let totalPenalty = 0;
    for (let deathIndex = 1; deathIndex <= deathCount; deathIndex++) {
        totalPenalty += getDeathPenaltyPerDeath(levelName, deathIndex);
    }
    return Math.max(0, LIVE_DEATHS_BASE - totalPenalty);
}

function getExpectedTimeBonus(levelName: string, bossRun: boolean, cap: number, elapsedMs: number): number {
    const spec = LevelConfig.get(levelName);
    const levelTier = Math.max(1, Number(spec.baseId || 1));
    const hardScalar = spec.isHard ? 1.15 : 1;
    const modeScalar = bossRun ? 0.9 : 1;
    const targetMs = Math.max(180_000, Math.round((120_000 + (levelTier * 60_000)) * hardScalar * modeScalar));
    const drainWindowMs = Math.max(targetMs, Math.round(targetMs * 1.5));
    const remainingRatio = Math.max(0, Math.min(1, 1 - (Math.min(Math.max(0, elapsedMs), drainWindowMs) / drainWindowMs)));
    return Math.round(cap * remainingRatio);
}

async function finalizeAndReadResult(client: FakeClient): Promise<ReturnType<typeof decodeDungeonCompletePacket>> {
    await MissionHandler.handleSetLevelComplete(client as never, createLevelCompletePacket());
    const resultPacket = client.sentPackets.find((packet) => packet.id === 0x87);
    assert.ok(resultPacket, 'dungeon completion should send 0x87');
    return decodeDungeonCompletePacket(resultPacket!.payload);
}

async function testBossRunNoDeathsKeepsDeathsBase(): Promise<void> {
    const client = createFakeDungeonClient('GhostBossDungeon', MissionID.KillNephit);
    const levelScope = getClientLevelScope(client as never);
    const boss = { id: 90002, name: 'NephitLargeEye', team: 2, entRank: 'Boss', hp: 10 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    resetTrackerEntityBuckets(client);
    triggerBossCutscene(client, boss);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: boss.id,
        targetEntity: boss,
        damage: 25
    });
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const result = await finalizeAndReadResult(client);
    assertResultMatchesTrackerSummary(client, result);
    assert.equal(client.dungeonRun.finalizedStats?.scoreMode, 'boss_run', 'pure boss completion should remain boss_run');
    assert.equal(result.deaths, LIVE_DEATHS_BASE, 'boss runs with no deaths should keep the 40000 deaths base');
}

async function testBossRunDeathsUseDungeonScaledPenalty(): Promise<void> {
    const client = createFakeDungeonClient('GhostBossDungeon', MissionID.KillNephit);
    const levelScope = getClientLevelScope(client as never);
    const boss = { id: 90012, name: 'NephitLargeEye', team: 2, entRank: 'Boss', hp: 10 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    resetTrackerEntityBuckets(client);
    noteDungeonRunDeath(client as never);
    triggerBossCutscene(client, boss);
    noteDungeonRunDeath(client as never);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: boss.id,
        targetEntity: boss,
        damage: 25
    });
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const result = await finalizeAndReadResult(client);
    const expected = getExpectedDeathScore('GhostBossDungeon', 2);
    assertResultMatchesTrackerSummary(client, result);
    assert.equal(result.deaths, expected, 'deaths should use the dungeon-scaled deterministic penalty formula');
    assert.equal(result.deaths < LIVE_DEATHS_BASE, true, 'deaths should fall below 40000 after one or more dungeon deaths');
}

async function testBossRunAccuracyUsesBossFightOnlyWhenNoPreBossHits(): Promise<void> {
    const client = createFakeDungeonClient('GhostBossDungeon', MissionID.KillNephit);
    const levelScope = getClientLevelScope(client as never);
    const preBossMinion = { id: 90021, name: 'GoblinClub', team: 2, entRank: 'Minion', hp: 10 };
    const boss = { id: 90022, name: 'NephitLargeEye', team: 2, entRank: 'Boss', hp: 10 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    resetTrackerEntityBuckets(client);
    noteDungeonRunEntitySeen(client as never, preBossMinion.id, preBossMinion);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });

    triggerBossCutscene(client, boss);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: boss.id,
        targetEntity: boss,
        damage: 25
    });
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const result = await finalizeAndReadResult(client);
    assertResultMatchesTrackerSummary(client, result);
    assert.equal(client.dungeonRun.finalizedStats?.accuracyWindowSource, 'boss_cutscene', 'boss-only runs should score accuracy from the boss window');
    assert.equal(result.accuracy, 20_000, 'one boss hit and one boss miss should score 20000 accuracy');
}

async function testBossRunAccuracyStartsAtFirstPreBossHit(): Promise<void> {
    const client = createFakeDungeonClient('GhostBossDungeon', MissionID.KillNephit);
    const levelScope = getClientLevelScope(client as never);
    const minion = { id: 90031, name: 'GoblinClub', team: 2, entRank: 'Minion', hp: 10 };
    const boss = { id: 90032, name: 'NephitLargeEye', team: 2, entRank: 'Boss', hp: 10 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    resetTrackerEntityBuckets(client);
    noteDungeonRunEntitySeen(client as never, minion.id, minion);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: minion.id,
        targetEntity: minion,
        damage: 25
    });
    noteDungeonRunKill(levelScope, ['trackerrunner'], minion.id, minion);

    triggerBossCutscene(client, boss);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: boss.id,
        targetEntity: boss,
        damage: 25
    });
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const result = await finalizeAndReadResult(client);
    assertResultMatchesTrackerSummary(client, result);
    assert.equal(client.dungeonRun.finalizedStats?.accuracyWindowSource, 'pre_boss_hit', 'pre-boss combat should anchor the accuracy window at the first hit');
    assert.equal(result.accuracy, Math.round(LIVE_ACCURACY_CAP * (2 / 3)), 'accuracy should count from the first pre-boss hit through the boss fight');
}

async function testBossRunElapsedTimingUsesEntryToBossDefeat(): Promise<void> {
    const client = createFakeDungeonClient('GhostBossDungeon', MissionID.KillNephit);
    const levelScope = getClientLevelScope(client as never);
    const boss = { id: 90042, name: 'NephitLargeEye', team: 2, entRank: 'Boss', hp: 10 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    resetTrackerEntityBuckets(client);
    const elapsedMs = 180_000;
    const runStart = Date.now() - elapsedMs;
    client.dungeonRun.entryStartTime = runStart;
    client.dungeonRun.runStartTime = runStart;
    client.dungeonRun.entryAccumulator.startTime = runStart;

    triggerBossCutscene(client, boss);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: boss.id,
        targetEntity: boss,
        damage: 25
    });
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const result = await finalizeAndReadResult(client);
    const timeCap = client.dungeonRun.finalizedStats!.scoreSummary.unlockedCap.timeBonus;
    const expected = getExpectedTimeBonus('GhostBossDungeon', true, timeCap, elapsedMs);
    assertResultMatchesTrackerSummary(client, result);
    assert.equal(result.timeBonus, expected, 'boss-run time bonus should use entry-to-boss-defeat elapsed time');
}

async function testBossSceneKillsOnlyUseBossEncounterEnemies(): Promise<void> {
    const client = createFakeDungeonClient('GhostBossDungeon', MissionID.KillNephit);
    const levelScope = getClientLevelScope(client as never);
    const preBossMinion = { id: 90051, name: 'GoblinClub', team: 2, entRank: 'Minion', hp: 10 };
    const boss = { id: 90052, name: 'NephitLargeEye', team: 2, entRank: 'Boss', hp: 10 };
    const bossAdd = { id: 90053, name: 'GhostMinion', team: 2, entRank: 'Minion', hp: 10 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    resetTrackerEntityBuckets(client);
    noteDungeonRunEntitySeen(client as never, preBossMinion.id, preBossMinion);

    triggerBossCutscene(client, boss);
    noteDungeonRunEntitySeen(client as never, bossAdd.id, bossAdd);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunHit(client as never, {
        sourceId: client.clientEntID,
        targetId: boss.id,
        targetEntity: boss,
        damage: 25
    });
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const result = await finalizeAndReadResult(client);
    assertResultMatchesTrackerSummary(client, result);
    assert.equal(client.dungeonRun.finalizedStats?.scoreMode, 'boss_run', 'skipping pre-boss enemies should stay in boss_run mode');
    assert.equal(result.kills, LIVE_BOSS_RUN_KILL_CAP / 2, 'boss-run kills should only score the boss-scene enemies');
}

async function testFinalPacketMatchesTrackerWithoutFallbackInflation(): Promise<void> {
    const client = createFakeDungeonClient('GhostBossDungeon', MissionID.KillNephit);
    const levelScope = getClientLevelScope(client as never);
    const boss = { id: 90062, name: 'NephitLargeEye', team: 2, entRank: 'Boss', hp: 10 };

    GlobalState.sessionsByToken.set(client.token, client as never);
    syncClientDungeonRunState(client as never);
    resetTrackerEntityBuckets(client);
    triggerBossCutscene(client, boss);
    noteDungeonRunCast(client as never, { sourceId: client.clientEntID, projectileId: null, isPersistent: false });
    noteDungeonRunKill(levelScope, ['trackerrunner'], boss.id, boss);

    const result = await finalizeAndReadResult(client);
    assertResultMatchesTrackerSummary(client, result);
    assert.equal(result.accuracy, 0, 'a boss kill without a landed scored hit should not get free accuracy');
    assert.notEqual(result.accuracy, 50, 'accuracy should not fall back to the old fabricated default');
    assert.notEqual(result.deaths, 80_000, 'deaths should no longer use the legacy profile-perfect value');
}

async function main(): Promise<void> {
    ensureGameDataLoaded();

    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    GlobalState.sessionsByToken.clear();

    try {
        await testBossRunNoDeathsKeepsDeathsBase();
        GlobalState.sessionsByToken.clear();

        await testBossRunDeathsUseDungeonScaledPenalty();
        GlobalState.sessionsByToken.clear();

        await testBossRunAccuracyUsesBossFightOnlyWhenNoPreBossHits();
        GlobalState.sessionsByToken.clear();

        await testBossRunAccuracyStartsAtFirstPreBossHit();
        GlobalState.sessionsByToken.clear();

        await testBossRunElapsedTimingUsesEntryToBossDefeat();
        GlobalState.sessionsByToken.clear();

        await testBossSceneKillsOnlyUseBossEncounterEnemies();
        GlobalState.sessionsByToken.clear();

        await testFinalPacketMatchesTrackerWithoutFallbackInflation();
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
