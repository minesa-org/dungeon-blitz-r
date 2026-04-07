import { Client } from './Client';
import { EntityTeam } from './Entity';
import { GameData } from './GameData';
import { GlobalState } from './GlobalState';
import { LevelConfig } from './LevelConfig';
import { getClientLevelScope } from './LevelScope';
import { getClientCharacterKey } from './PartySync';
import { sharesRoomIds } from './PartySync';
import {
    buildDefaultDungeonScoreProfile,
    getDungeonScoreProfile,
    ResolvedDungeonScoreProfile
} from './DungeonScoreProfiles';
import { NpcLoader } from '../data/NpcLoader';

export type DungeonRunCompletionReason = 'success' | 'fail' | 'leave' | 'abort' | 'unknown';
export type DungeonRunClassification = 'incomplete' | 'objective_clear' | 'full_clear';
export type DungeonRunScoreMode = 'pending' | 'boss_run' | 'dungeon_clear';
export type DungeonRunAccuracyWindowSource = 'none' | 'pre_boss_hit' | 'boss_cutscene';
export type DungeonRunLedgerEventType =
    | 'entry'
    | 'entity_seen'
    | 'cast'
    | 'hit'
    | 'kill'
    | 'death'
    | 'treasure'
    | 'chest_opened'
    | 'boss_cutscene'
    | 'boss_fight_start'
    | 'boss_defeat'
    | 'completion_progress'
    | 'finalize';

type PendingShot = {
    key: string;
    projectileId: number | null;
    createdAt: number;
    resolved: boolean;
};

export type DungeonRunLedgerEvent = {
    type: DungeonRunLedgerEventType;
    at: number;
    entityId?: number;
    roomId?: number;
    value?: number;
    note?: string;
};

export type DungeonRunFinalizedStats = {
    dungeonId: string;
    levelName: string;
    levelScope: string;
    runStartTime: number;
    entryStartTime: number;
    scoreWindowStartTime: number;
    accuracyWindowStartTime: number;
    runEndTime: number;
    elapsedMs: number;
    playerDeaths: number;
    totalEnemiesEligible: number;
    killedEnemies: number;
    skippedEnemies: number;
    totalChestsEligible: number;
    openedChests: number;
    totalShots: number;
    successfulHits: number;
    missedShots: number;
    accuracyRatio: number;
    totalObjectivesEligible: number;
    completedObjectives: number;
    failedObjectives: number;
    bossKilled: boolean;
    bossFightStartTime: number | null;
    bossDefeatTime: number | null;
    dungeonCompleted: boolean;
    runClassification: DungeonRunClassification;
    scoreMode: DungeonRunScoreMode;
    scoreSummary: DungeonRunScoreSummary;
    completionReason: DungeonRunCompletionReason;
    treasureGold: number;
    completionPercent: number;
    accuracyWindowSource: DungeonRunAccuracyWindowSource;
    eventLedger: DungeonRunLedgerEvent[];
};

export type DungeonRunScoreBudget = {
    kills: number;
    treasure: number;
    accuracy: number;
    deaths: number;
    timeBonus: number;
    total: number;
};

export type DungeonRunScoreSummary = {
    profile: ResolvedDungeonScoreProfile;
    progressionNodesTotal: number;
    progressionNodesCompleted: number;
    enemyNodesTotal: number;
    enemyNodesCompleted: number;
    chestNodesTotal: number;
    chestNodesCompleted: number;
    objectiveNodesTotal: number;
    objectiveNodesCompleted: number;
    unlockedCap: DungeonRunScoreBudget;
    rawEarned: DungeonRunScoreBudget;
    finalStat: DungeonRunScoreBudget;
    stars: number;
    rank: number;
    resultBar: number;
};

export type DungeonRunDebugSnapshot = {
    dungeonId: string;
    runInstanceId: string;
    finalized: boolean;
    completionState: DungeonRunCompletionReason;
    finalizedSource: string;
    bossKilled: boolean;
    runClassification: DungeonRunClassification;
    scoreMode: DungeonRunScoreMode;
    scoreWindowStartTime: number;
    bossCutsceneTriggeredAt: number | null;
    eligibleEnemyCount: number;
    killedEnemyCount: number;
    missingEnemyIds: number[];
    eligibleChestCount: number;
    openedChestCount: number;
    missingChestIds: number[];
    totalShots: number;
    successfulShots: number;
    missedShots: number;
    accuracyRatio: number;
    playerDeaths: number;
    elapsedMs: number;
};

type DungeonRunAccumulator = {
    startTime: number;
    playerDeaths: number;
    totalEnemiesEligible: number;
    killedEnemies: number;
    skippedEnemies: number;
    totalChestsEligible: number;
    openedChests: number;
    totalShots: number;
    successfulHits: number;
    missedShots: number;
    accuracyRatio: number;
    totalObjectivesEligible: number;
    completedObjectives: number;
    failedObjectives: number;
    treasureGold: number;
    eligibleEnemyIds: Set<number>;
    killedEnemyIds: Set<number>;
    bossEnemyIds: Set<number>;
    eligibleChestIds: Set<number>;
    openedChestIds: Set<number>;
    eligibleObjectiveIds: Set<number>;
    completedObjectiveIds: Set<number>;
    failedObjectiveIds: Set<number>;
    pendingShots: Map<string, PendingShot>;
    nextShotSequence: number;
};

export interface DungeonRunStats extends DungeonRunFinalizedStats {
    eligibleEnemyIds: Set<number>;
    killedEnemyIds: Set<number>;
    bossEnemyIds: Set<number>;
    eligibleChestIds: Set<number>;
    openedChestIds: Set<number>;
    eligibleObjectiveIds: Set<number>;
    completedObjectiveIds: Set<number>;
    failedObjectiveIds: Set<number>;
    pendingShots: Map<string, PendingShot>;
    nextShotSequence: number;
    scoreWindowActive: boolean;
    bossCutsceneTriggeredAt: number | null;
    preBossEncounterEngaged: boolean;
    entryAccumulator: DungeonRunAccumulator;
    windowAccumulator: DungeonRunAccumulator;
    accuracyWindowActive: boolean;
    finalizedAt: number | null;
    finalizedStats: DungeonRunFinalizedStats | null;
}

type DungeonRunEntityKind = {
    enemy: boolean;
    boss: boolean;
    chest: boolean;
    objective: boolean;
};

type DungeonRunFinalizeOptions = {
    completionPercent?: number;
    dungeonCompleted?: boolean;
};

type DungeonRunCastContext = {
    sourceId: number;
    projectileId: number | null;
    isPersistent: boolean;
};

type DungeonRunHitContext = {
    sourceId: number;
    targetId: number;
    targetEntity: any;
    damage: number;
};

const DIRECT_ENEMY_RANKS = new Set(['Minion', 'Lieutenant', 'MiniBoss', 'Boss']);
const DUNGEON_RUN_DEBUG_ENABLED = String(process.env.DUNGEON_RUN_DEBUG ?? '').trim() === '1';
const LIVE_ACCURACY_CAP = 40_000;
const LIVE_DEATHS_BASE = 40_000;
const LIVE_BOSS_RUN_KILL_CAP = 160_000;

function recordDungeonRunEvent(
    stats: DungeonRunStats,
    type: DungeonRunLedgerEventType,
    extra: Omit<DungeonRunLedgerEvent, 'type' | 'at'> = {}
): void {
    stats.eventLedger.push({
        type,
        at: Date.now(),
        ...extra
    });
}

function getDungeonDifficultyScalar(levelName: string): number {
    const spec = LevelConfig.get(levelName);
    const levelTier = Math.max(1, Number(spec.baseId || 1));
    return (spec.isHard ? 1.35 : 1) * (1 + ((levelTier - 1) * 0.08));
}

function getDeathPenaltyPerDeath(levelName: string, deathIndex: number): number {
    const spec = LevelConfig.get(levelName);
    const levelTier = Math.max(1, Number(spec.baseId || 1));
    const difficultyScalar = getDungeonDifficultyScalar(levelName);
    const streakScalar = 1 + (Math.max(1, deathIndex) - 1) * 0.2;
    return Math.max(
        1,
        Math.round((4_000 + (levelTier * 750)) * difficultyScalar * streakScalar)
    );
}

function calculateDeathsScore(levelName: string, deathCount: number): number {
    const normalizedDeaths = Math.max(0, Math.round(Number(deathCount) || 0));
    if (normalizedDeaths <= 0) {
        return LIVE_DEATHS_BASE;
    }

    let totalPenalty = 0;
    for (let deathIndex = 1; deathIndex <= normalizedDeaths; deathIndex++) {
        totalPenalty += getDeathPenaltyPerDeath(levelName, deathIndex);
    }
    return Math.max(0, LIVE_DEATHS_BASE - totalPenalty);
}

function getDungeonTimeTargetMs(levelName: string, scoreMode: DungeonRunScoreMode): number {
    const spec = LevelConfig.get(levelName);
    const levelTier = Math.max(1, Number(spec.baseId || 1));
    const hardScalar = spec.isHard ? 1.15 : 1;
    const modeScalar = scoreMode === 'boss_run' ? 0.9 : 1;
    return Math.max(
        180_000,
        Math.round((120_000 + (levelTier * 60_000)) * hardScalar * modeScalar)
    );
}

function getScoredElapsedMs(stats: Pick<DungeonRunStats, 'scoreMode' | 'entryStartTime' | 'runEndTime' | 'bossDefeatTime'>): number {
    const now = Date.now();
    const scoreEndTime = stats.scoreMode === 'boss_run'
        ? (stats.bossDefeatTime ?? (stats.runEndTime > 0 ? stats.runEndTime : now))
        : (stats.runEndTime > 0 ? stats.runEndTime : now);
    return Math.max(0, scoreEndTime - stats.entryStartTime);
}

function calculateTimeBonusScore(
    levelName: string,
    scoreMode: DungeonRunScoreMode,
    timeBonusCap: number,
    elapsedMs: number
): number {
    const targetMs = getDungeonTimeTargetMs(levelName, scoreMode);
    const drainWindowMs = Math.max(targetMs, Math.round(targetMs * 1.5));
    const remainingRatio = clampRatio(1 - (Math.min(Math.max(0, elapsedMs), drainWindowMs) / drainWindowMs));
    return Math.round(Math.max(0, timeBonusCap) * remainingRatio);
}

function clampRatio(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, Math.min(1, value));
}

function normalizeCompletionPercent(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
        return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numeric)));
}

function createAccumulator(startTime: number): DungeonRunAccumulator {
    return {
        startTime,
        playerDeaths: 0,
        totalEnemiesEligible: 0,
        killedEnemies: 0,
        skippedEnemies: 0,
        totalChestsEligible: 0,
        openedChests: 0,
        totalShots: 0,
        successfulHits: 0,
        missedShots: 0,
        accuracyRatio: 0,
        totalObjectivesEligible: 0,
        completedObjectives: 0,
        failedObjectives: 0,
        treasureGold: 0,
        eligibleEnemyIds: new Set<number>(),
        killedEnemyIds: new Set<number>(),
        bossEnemyIds: new Set<number>(),
        eligibleChestIds: new Set<number>(),
        openedChestIds: new Set<number>(),
        eligibleObjectiveIds: new Set<number>(),
        completedObjectiveIds: new Set<number>(),
        failedObjectiveIds: new Set<number>(),
        pendingShots: new Map<string, PendingShot>(),
        nextShotSequence: 0
    };
}

function createZeroBudget(): DungeonRunScoreBudget {
    return {
        kills: 0,
        treasure: 0,
        accuracy: 0,
        deaths: 0,
        timeBonus: 0,
        total: 0
    };
}

function isTreasureChestEntity(name: string, behavior: string): boolean {
    return /treasurechest/i.test(name) || /questtreasurechest/i.test(name) || behavior === 'TreasureChest';
}

function classifyDungeonRunEntity(entity: any): DungeonRunEntityKind {
    if (!entity || entity.isPlayer) {
        return {
            enemy: false,
            boss: false,
            chest: false,
            objective: false
        };
    }

    const name = String(entity?.name ?? '').trim();
    const entType = name ? GameData.getEntType(name) ?? {} : {};
    const behavior = String(entity?.behavior ?? entType?.Behavior ?? '').trim();
    const rank = String(entity?.entRank ?? entType?.EntRank ?? '').trim();
    const hitPoints = Number(entity?.hp ?? entType?.HitPoints ?? 0);
    const team = Number(entity?.team ?? EntityTeam.UNKNOWN);
    const chest = isTreasureChestEntity(name, behavior);
    const objective = !chest && /Target|Objective/i.test(behavior);
    const enemy = !chest &&
        !objective &&
        team === EntityTeam.ENEMY &&
        (DIRECT_ENEMY_RANKS.has(rank) || hitPoints > 0);

    return {
        enemy,
        boss: enemy && (rank === 'Boss' || rank === 'MiniBoss'),
        chest,
        objective
    };
}

function refreshAccumulatorFields(accumulator: DungeonRunAccumulator, dungeonCompleted: boolean, completionPercent: number): void {
    accumulator.totalEnemiesEligible = accumulator.eligibleEnemyIds.size;
    accumulator.killedEnemies = accumulator.killedEnemyIds.size;
    accumulator.skippedEnemies = Math.max(0, accumulator.totalEnemiesEligible - accumulator.killedEnemies);
    accumulator.totalChestsEligible = accumulator.eligibleChestIds.size;
    accumulator.openedChests = accumulator.openedChestIds.size;
    accumulator.totalObjectivesEligible = accumulator.eligibleObjectiveIds.size;
    accumulator.completedObjectives = accumulator.completedObjectiveIds.size;
    accumulator.failedObjectives = Math.max(
        accumulator.failedObjectiveIds.size,
        accumulator.totalObjectivesEligible - accumulator.completedObjectives
    );
    const combatCoverageRatio = accumulator.totalEnemiesEligible > 0
        ? clampRatio(accumulator.killedEnemies / accumulator.totalEnemiesEligible)
        : accumulator.totalObjectivesEligible > 0
            ? clampRatio(accumulator.completedObjectives / accumulator.totalObjectivesEligible)
            : dungeonCompleted
                ? 1
                : clampRatio(completionPercent / 100);
    const shotAccuracyRatio = accumulator.totalShots > 0
        ? clampRatio(accumulator.successfulHits / accumulator.totalShots)
        : 1;
    accumulator.accuracyRatio = clampRatio(shotAccuracyRatio * combatCoverageRatio);
}

function syncStatsFromAccumulator(stats: DungeonRunStats): void {
    const accumulator = stats.windowAccumulator;
    stats.runStartTime = stats.entryStartTime;
    stats.scoreWindowStartTime = accumulator.startTime;
    stats.playerDeaths = stats.entryAccumulator.playerDeaths;
    stats.totalEnemiesEligible = accumulator.totalEnemiesEligible;
    stats.killedEnemies = accumulator.killedEnemies;
    stats.skippedEnemies = accumulator.skippedEnemies;
    stats.totalChestsEligible = accumulator.totalChestsEligible;
    stats.openedChests = accumulator.openedChests;
    const resolvedShotCount = stats.totalShots > 0
        ? Math.min(stats.totalShots, stats.successfulHits + stats.missedShots)
        : 0;
    stats.totalShots = Math.max(stats.totalShots, resolvedShotCount);
    stats.accuracyRatio = clampRatio(stats.totalShots > 0 ? stats.successfulHits / stats.totalShots : 0);
    stats.totalObjectivesEligible = accumulator.totalObjectivesEligible;
    stats.completedObjectives = accumulator.completedObjectives;
    stats.failedObjectives = accumulator.failedObjectives;
    stats.treasureGold = accumulator.treasureGold;
    stats.eligibleEnemyIds = cloneSet(accumulator.eligibleEnemyIds);
    stats.killedEnemyIds = cloneSet(accumulator.killedEnemyIds);
    stats.bossEnemyIds = cloneSet(accumulator.bossEnemyIds);
    stats.eligibleChestIds = cloneSet(accumulator.eligibleChestIds);
    stats.openedChestIds = cloneSet(accumulator.openedChestIds);
    stats.eligibleObjectiveIds = cloneSet(accumulator.eligibleObjectiveIds);
    stats.completedObjectiveIds = cloneSet(accumulator.completedObjectiveIds);
    stats.failedObjectiveIds = cloneSet(accumulator.failedObjectiveIds);
    stats.runClassification = classifyDungeonRun(stats);
    stats.elapsedMs = getScoredElapsedMs(stats);
    stats.scoreSummary = buildDungeonRunScoreSummary(stats);
}

function classifyDungeonRun(
    stats: Pick<DungeonRunStats, 'dungeonCompleted' | 'skippedEnemies' | 'failedObjectives' | 'scoreMode'>
): DungeonRunClassification {
    if (!stats.dungeonCompleted) {
        return 'incomplete';
    }

    if (stats.scoreMode === 'boss_run') {
        return 'objective_clear';
    }

    if (stats.skippedEnemies <= 0 && stats.failedObjectives <= 0) {
        return 'full_clear';
    }

    return 'objective_clear';
}

function noteAccumulatorEntity(accumulator: DungeonRunAccumulator, entityId: number, entity: any, dungeonCompleted: boolean, completionPercent: number): void {
    if (!entityId || !entity) {
        return;
    }

    const kind = classifyDungeonRunEntity(entity);
    if (kind.enemy) {
        accumulator.eligibleEnemyIds.add(entityId);
    }
    if (kind.boss) {
        accumulator.bossEnemyIds.add(entityId);
    }
    if (kind.chest) {
        accumulator.eligibleChestIds.add(entityId);
    }
    if (kind.objective) {
        accumulator.eligibleObjectiveIds.add(entityId);
    }

    refreshAccumulatorFields(accumulator, dungeonCompleted, completionPercent);
}

function copyAccumulator(source: DungeonRunAccumulator): DungeonRunAccumulator {
    return {
        ...source,
        eligibleEnemyIds: cloneSet(source.eligibleEnemyIds),
        killedEnemyIds: cloneSet(source.killedEnemyIds),
        bossEnemyIds: cloneSet(source.bossEnemyIds),
        eligibleChestIds: cloneSet(source.eligibleChestIds),
        openedChestIds: cloneSet(source.openedChestIds),
        eligibleObjectiveIds: cloneSet(source.eligibleObjectiveIds),
        completedObjectiveIds: cloneSet(source.completedObjectiveIds),
        failedObjectiveIds: cloneSet(source.failedObjectiveIds),
        pendingShots: clonePendingShots(source.pendingShots)
    };
}

function shouldPromotePendingRunForEntity(kind: DungeonRunEntityKind): boolean {
    return (kind.enemy && !kind.boss) || kind.chest || kind.objective;
}

function applyFallbackObjectiveProgress(stats: DungeonRunStats): void {
    const accumulator = stats.windowAccumulator;
    if (accumulator.totalObjectivesEligible > 0) {
        return;
    }

    if (stats.completionPercent <= 0 && !stats.dungeonCompleted) {
        return;
    }

    accumulator.totalObjectivesEligible = 1;
    accumulator.eligibleObjectiveIds = new Set<number>([0]);
    if (stats.dungeonCompleted || stats.completionPercent >= 100) {
        accumulator.completedObjectives = 1;
        accumulator.completedObjectiveIds = new Set<number>([0]);
        accumulator.failedObjectives = 0;
        accumulator.failedObjectiveIds.clear();
    } else {
        accumulator.completedObjectives = 0;
        accumulator.completedObjectiveIds.clear();
        accumulator.failedObjectives = 1;
        accumulator.failedObjectiveIds = new Set<number>([0]);
    }
}

function createDungeonRunStats(client: Client, levelName: string, levelScope: string): DungeonRunStats {
    const now = Date.now();
    const entryAccumulator = createAccumulator(now);
    const windowAccumulator = createAccumulator(now);
    const stats: DungeonRunStats = {
        dungeonId: levelScope,
        levelName,
        levelScope,
        runStartTime: now,
        entryStartTime: now,
        scoreWindowStartTime: now,
        accuracyWindowStartTime: now,
        runEndTime: 0,
        elapsedMs: 0,
        playerDeaths: 0,
        totalEnemiesEligible: 0,
        killedEnemies: 0,
        skippedEnemies: 0,
        totalChestsEligible: 0,
        openedChests: 0,
        totalShots: 0,
        successfulHits: 0,
        missedShots: 0,
        accuracyRatio: 0,
        totalObjectivesEligible: 0,
        completedObjectives: 0,
        failedObjectives: 0,
        bossKilled: false,
        bossFightStartTime: null,
        bossDefeatTime: null,
        dungeonCompleted: false,
        runClassification: 'incomplete',
        scoreMode: 'pending',
        scoreSummary: {
            profile: getDungeonScoreProfile(levelName) ?? buildDefaultDungeonScoreProfile(levelName),
            progressionNodesTotal: 0,
            progressionNodesCompleted: 0,
            enemyNodesTotal: 0,
            enemyNodesCompleted: 0,
            chestNodesTotal: 0,
            chestNodesCompleted: 0,
            objectiveNodesTotal: 0,
            objectiveNodesCompleted: 0,
            unlockedCap: createZeroBudget(),
            rawEarned: createZeroBudget(),
            finalStat: createZeroBudget(),
            stars: 0,
            rank: 10,
            resultBar: (getDungeonScoreProfile(levelName) ?? buildDefaultDungeonScoreProfile(levelName)).resultBar
        },
        completionReason: 'unknown',
        treasureGold: 0,
        completionPercent: 0,
        accuracyWindowSource: 'none',
        eventLedger: [],
        eligibleEnemyIds: new Set<number>(),
        killedEnemyIds: new Set<number>(),
        bossEnemyIds: new Set<number>(),
        eligibleChestIds: new Set<number>(),
        openedChestIds: new Set<number>(),
        eligibleObjectiveIds: new Set<number>(),
        completedObjectiveIds: new Set<number>(),
        failedObjectiveIds: new Set<number>(),
        pendingShots: new Map<string, PendingShot>(),
        nextShotSequence: 0,
        scoreWindowActive: false,
        bossCutsceneTriggeredAt: null,
        preBossEncounterEngaged: false,
        entryAccumulator,
        windowAccumulator,
        accuracyWindowActive: false,
        finalizedAt: null,
        finalizedStats: null
    };
    recordDungeonRunEvent(stats, 'entry');

    for (const npc of NpcLoader.getRawNpcsForLevel(levelName)) {
        noteAccumulatorEntity(entryAccumulator, Number(npc?.id ?? 0), npc, stats.dungeonCompleted, stats.completionPercent);
    }
    refreshAccumulatorFields(windowAccumulator, stats.dungeonCompleted, stats.completionPercent);
    syncStatsFromAccumulator(stats);
    return stats;
}

function cloneSet(source: Set<number>): Set<number> {
    return new Set<number>(source.values());
}

function getMissingIds(eligible: Set<number>, actual: Set<number>): number[] {
    const missing: number[] = [];
    for (const entityId of eligible.values()) {
        if (!actual.has(entityId)) {
            missing.push(entityId);
        }
    }

    return missing.sort((left, right) => left - right);
}

function clonePendingShots(source: Map<string, PendingShot>): Map<string, PendingShot> {
    return new Map<string, PendingShot>(
        Array.from(source.entries(), ([key, shot]) => [
            key,
            {
                ...shot
            }
        ])
    );
}

function startAccuracyWindow(
    stats: DungeonRunStats,
    source: DungeonRunAccuracyWindowSource,
    startTime: number
): void {
    if (stats.accuracyWindowActive) {
        return;
    }

    stats.accuracyWindowActive = true;
    stats.accuracyWindowSource = source;
    stats.accuracyWindowStartTime = startTime;
    stats.totalShots = 0;
    stats.successfulHits = 0;
    stats.missedShots = 0;
    stats.pendingShots = new Map<string, PendingShot>();
    stats.nextShotSequence = 0;
}

function ensureBossFightStarted(stats: DungeonRunStats, startedAt: number): void {
    if (stats.bossFightStartTime !== null) {
        return;
    }

    stats.bossFightStartTime = startedAt;
    recordDungeonRunEvent(stats, 'boss_fight_start');
}

function noteAccuracyCast(stats: DungeonRunStats, projectileId: number | null): void {
    if (!stats.accuracyWindowActive) {
        return;
    }

    const shotKey = projectileId !== null
        ? `projectile:${projectileId}`
        : `cast:${++stats.nextShotSequence}`;
    stats.totalShots += 1;
    stats.pendingShots.set(shotKey, {
        key: shotKey,
        projectileId,
        createdAt: Date.now(),
        resolved: false
    });
}

function noteAccuracyHit(stats: DungeonRunStats): void {
    if (!stats.accuracyWindowActive) {
        return;
    }

    const shot = findOldestPendingShot(stats);
    if (shot) {
        shot.resolved = true;
    } else {
        stats.totalShots += 1;
    }
    stats.successfulHits += 1;
}

function findOldestPendingShot(stats: DungeonRunStats): PendingShot | null {
    for (const shot of stats.pendingShots.values()) {
        if (!shot.resolved) {
            return shot;
        }
    }

    return null;
}

function promotePendingRunToDungeonClear(stats: DungeonRunStats): void {
    if (stats.scoreMode !== 'pending') {
        return;
    }

    stats.scoreMode = 'dungeon_clear';
    stats.scoreWindowActive = true;
    stats.windowAccumulator = copyAccumulator(stats.entryAccumulator);
    refreshAccumulatorFields(stats.windowAccumulator, stats.dungeonCompleted, stats.completionPercent);
    syncStatsFromAccumulator(stats);
}

function activateBossRunScoreWindow(stats: DungeonRunStats, client: Client, roomId: number, bossId?: number | null): void {
    if (stats.scoreMode !== 'pending') {
        return;
    }

    const now = Date.now();
    stats.scoreMode = 'boss_run';
    stats.scoreWindowActive = true;
    stats.bossCutsceneTriggeredAt = now;
    stats.windowAccumulator = createAccumulator(now);
    startAccuracyWindow(stats, 'boss_cutscene', now);
    recordDungeonRunEvent(stats, 'boss_cutscene', {
        roomId
    });

    for (const [entityId, entity] of client.entities.entries()) {
        if (!sharesRoomIds(roomId, Number(entity?.roomId ?? roomId))) {
            continue;
        }
        noteAccumulatorEntity(stats.windowAccumulator, entityId, entity, stats.dungeonCompleted, stats.completionPercent);
    }

    if (bossId && !stats.windowAccumulator.eligibleEnemyIds.has(bossId)) {
        const bossEntity =
            client.entities.get(bossId) ??
            Array.from(client.entities.values()).find((entity) => Number(entity?.id ?? 0) === bossId);
        if (bossEntity) {
            noteAccumulatorEntity(stats.windowAccumulator, bossId, bossEntity, stats.dungeonCompleted, stats.completionPercent);
        }
    }

    syncStatsFromAccumulator(stats);
}

function getTargetAccumulator(stats: DungeonRunStats): DungeonRunAccumulator {
    return stats.scoreMode === 'pending'
        ? stats.entryAccumulator
        : stats.windowAccumulator;
}

function noteDungeonRunEntity(stats: DungeonRunStats, entityId: number, entity: any): void {
    if (!entityId || !entity || stats.finalizedAt) {
        return;
    }

    recordDungeonRunEvent(stats, 'entity_seen', {
        entityId
    });
    noteAccumulatorEntity(stats.entryAccumulator, entityId, entity, stats.dungeonCompleted, stats.completionPercent);
    const target = getTargetAccumulator(stats);
    if (target !== stats.entryAccumulator) {
        noteAccumulatorEntity(target, entityId, entity, stats.dungeonCompleted, stats.completionPercent);
    }
    if (stats.scoreMode !== 'pending') {
        syncStatsFromAccumulator(stats);
    }
}

export function cloneDungeonRunStats(stats: DungeonRunStats | null | undefined): DungeonRunStats | null {
    if (!stats) {
        return null;
    }

    return {
        ...stats,
        finalizedStats: stats.finalizedStats
            ? {
                ...stats.finalizedStats,
                scoreSummary: {
                    ...stats.finalizedStats.scoreSummary,
                    profile: { ...stats.finalizedStats.scoreSummary.profile },
                    unlockedCap: { ...stats.finalizedStats.scoreSummary.unlockedCap },
                    rawEarned: { ...stats.finalizedStats.scoreSummary.rawEarned },
                    finalStat: { ...stats.finalizedStats.scoreSummary.finalStat }
                },
                eventLedger: stats.finalizedStats.eventLedger.map((entry) => ({ ...entry }))
            }
            : null,
        entryAccumulator: copyAccumulator(stats.entryAccumulator),
        windowAccumulator: copyAccumulator(stats.windowAccumulator),
        eligibleEnemyIds: cloneSet(stats.eligibleEnemyIds),
        killedEnemyIds: cloneSet(stats.killedEnemyIds),
        bossEnemyIds: cloneSet(stats.bossEnemyIds),
        eligibleChestIds: cloneSet(stats.eligibleChestIds),
        openedChestIds: cloneSet(stats.openedChestIds),
        eligibleObjectiveIds: cloneSet(stats.eligibleObjectiveIds),
        completedObjectiveIds: cloneSet(stats.completedObjectiveIds),
        failedObjectiveIds: cloneSet(stats.failedObjectiveIds),
        pendingShots: clonePendingShots(stats.pendingShots),
        eventLedger: stats.eventLedger.map((entry) => ({ ...entry }))
    };
}

export function syncClientDungeonRunState(client: Client): DungeonRunStats | null {
    const levelName = LevelConfig.normalizeLevelName(client.currentLevel);
    const levelScope = getClientLevelScope(client);
    if (!levelName || !levelScope || !LevelConfig.isDungeonLevel(levelName)) {
        client.dungeonRun = null;
        return null;
    }

    if (
        !client.dungeonRun ||
        client.dungeonRun.levelName !== levelName ||
        client.dungeonRun.levelScope !== levelScope
    ) {
        client.dungeonRun = createDungeonRunStats(client, levelName, levelScope);
    }

    return client.dungeonRun;
}

export function getActiveDungeonRunStats(client: Client): DungeonRunStats | null {
    const levelName = LevelConfig.normalizeLevelName(client.currentLevel);
    const levelScope = getClientLevelScope(client);
    if (!levelName || !levelScope || !LevelConfig.isDungeonLevel(levelName)) {
        return null;
    }

    const stats = client.dungeonRun;
    if (!stats || stats.levelName !== levelName || stats.levelScope !== levelScope) {
        return syncClientDungeonRunState(client);
    }

    syncStatsFromAccumulator(stats);
    return stats;
}

export function noteDungeonRunEntitySeen(client: Client, entityId: number, entity: any): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats) {
        return;
    }

    noteDungeonRunEntity(stats, entityId, entity);
}

export function noteDungeonRunCast(client: Client, context: DungeonRunCastContext): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt || context.sourceId !== client.clientEntID || context.isPersistent) {
        return;
    }

    if (stats.bossCutsceneTriggeredAt !== null) {
        ensureBossFightStarted(stats, Date.now());
    }

    if (stats.scoreMode === 'boss_run' && !stats.accuracyWindowActive) {
        startAccuracyWindow(stats, 'boss_cutscene', stats.bossCutsceneTriggeredAt ?? Date.now());
    }

    noteAccuracyCast(stats, context.projectileId);
    recordDungeonRunEvent(stats, 'cast');
    syncStatsFromAccumulator(stats);
}

export function noteDungeonRunHit(client: Client, context: DungeonRunHitContext): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt || context.sourceId !== client.clientEntID || context.damage <= 0) {
        return;
    }

    noteDungeonRunEntity(stats, context.targetId, context.targetEntity);
    const kind = classifyDungeonRunEntity(context.targetEntity);
    if (!kind.enemy && !kind.objective) {
        return;
    }

    if (stats.scoreMode === 'pending' && shouldPromotePendingRunForEntity(kind)) {
        stats.preBossEncounterEngaged = true;
        promotePendingRunToDungeonClear(stats);
        startAccuracyWindow(stats, 'pre_boss_hit', Date.now());
    } else if (stats.scoreMode === 'boss_run' && !stats.accuracyWindowActive) {
        startAccuracyWindow(stats, 'boss_cutscene', stats.bossCutsceneTriggeredAt ?? Date.now());
    }

    if (stats.bossCutsceneTriggeredAt !== null) {
        ensureBossFightStarted(stats, Date.now());
    }

    const accumulator = getTargetAccumulator(stats);
    if (kind.objective) {
        accumulator.completedObjectiveIds.add(context.targetId);
    }
    noteAccuracyHit(stats);
    recordDungeonRunEvent(stats, 'hit', {
        entityId: context.targetId,
        value: context.damage
    });
    refreshAccumulatorFields(accumulator, stats.dungeonCompleted, stats.completionPercent);
    syncStatsFromAccumulator(stats);
}

export function noteDungeonRunTreasure(client: Client, gold: number): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt) {
        return;
    }

    const accumulator = getTargetAccumulator(stats);
    accumulator.treasureGold += Math.max(0, Math.round(Number(gold) || 0));
    recordDungeonRunEvent(stats, 'treasure', {
        value: Math.max(0, Math.round(Number(gold) || 0))
    });
    syncStatsFromAccumulator(stats);
}

export function noteDungeonRunChestOpened(client: Client, sourceId: number, sourceEntity: any): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt || sourceId <= 0) {
        return;
    }

    noteDungeonRunEntity(stats, sourceId, sourceEntity);
    const kind = classifyDungeonRunEntity(sourceEntity);
    if (!kind.chest) {
        return;
    }

    if (stats.scoreMode === 'pending') {
        stats.preBossEncounterEngaged = true;
        promotePendingRunToDungeonClear(stats);
    }

    const accumulator = getTargetAccumulator(stats);
    accumulator.openedChestIds.add(sourceId);
    refreshAccumulatorFields(accumulator, stats.dungeonCompleted, stats.completionPercent);
    recordDungeonRunEvent(stats, 'chest_opened', {
        entityId: sourceId
    });
    syncStatsFromAccumulator(stats);
}

export function noteDungeonRunDeath(client: Client): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt) {
        return;
    }

    stats.entryAccumulator.playerDeaths += 1;
    const accumulator = getTargetAccumulator(stats);
    if (accumulator !== stats.entryAccumulator) {
        accumulator.playerDeaths += 1;
        refreshAccumulatorFields(accumulator, stats.dungeonCompleted, stats.completionPercent);
    }
    recordDungeonRunEvent(stats, 'death', {
        value: stats.entryAccumulator.playerDeaths
    });
    syncStatsFromAccumulator(stats);
}

export function noteDungeonRunCompletionProgress(client: Client, completionPercent: number): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt) {
        return;
    }

    stats.completionPercent = normalizeCompletionPercent(completionPercent);
    refreshAccumulatorFields(stats.entryAccumulator, stats.dungeonCompleted, stats.completionPercent);
    refreshAccumulatorFields(stats.windowAccumulator, stats.dungeonCompleted, stats.completionPercent);
    recordDungeonRunEvent(stats, 'completion_progress', {
        value: stats.completionPercent
    });
    syncStatsFromAccumulator(stats);
}

export function noteDungeonRunKill(
    levelScope: string | null | undefined,
    contributorKeys: string[],
    entityId?: number | null,
    entity?: any
): void {
    const normalizedScope = String(levelScope ?? '').trim();
    if (!normalizedScope || !contributorKeys.length) {
        return;
    }

    const remainingKeys = new Set(
        contributorKeys
            .map((value) => String(value ?? '').trim().toLowerCase())
            .filter(Boolean)
    );
    if (!remainingKeys.size) {
        return;
    }

    for (const session of GlobalState.sessionsByToken.values()) {
        if (!session.playerSpawned || getClientLevelScope(session) !== normalizedScope) {
            continue;
        }

        const characterKey = getClientCharacterKey(session);
        if (!characterKey || !remainingKeys.has(characterKey)) {
            continue;
        }

        const stats = getActiveDungeonRunStats(session);
        if (stats && stats.levelScope === normalizedScope) {
            if (entityId && entity) {
                noteDungeonRunEntity(stats, entityId, entity);
                const kind = classifyDungeonRunEntity(entity);
                if (stats.scoreMode === 'pending' && shouldPromotePendingRunForEntity(kind)) {
                    stats.preBossEncounterEngaged = true;
                    promotePendingRunToDungeonClear(stats);
                }
                const accumulator = getTargetAccumulator(stats);
                if (kind.enemy) {
                    accumulator.killedEnemyIds.add(entityId);
                }
                if (kind.boss) {
                    stats.bossKilled = true;
                    stats.bossDefeatTime = Date.now();
                    ensureBossFightStarted(stats, stats.bossDefeatTime);
                    recordDungeonRunEvent(stats, 'boss_defeat', {
                        entityId
                    });
                }
                if (kind.objective) {
                    accumulator.completedObjectiveIds.add(entityId);
                }
                refreshAccumulatorFields(accumulator, stats.dungeonCompleted, stats.completionPercent);
                recordDungeonRunEvent(stats, 'kill', {
                    entityId
                });
                syncStatsFromAccumulator(stats);
            }
        }
        remainingKeys.delete(characterKey);

        if (!remainingKeys.size) {
            break;
        }
    }
}

export function finalizeDungeonRun(
    client: Client,
    reason: DungeonRunCompletionReason,
    options: DungeonRunFinalizeOptions = {}
): DungeonRunFinalizedStats | null {
    const stats = getActiveDungeonRunStats(client);
    if (!stats) {
        return null;
    }

    if (stats.finalizedStats) {
        return stats.finalizedStats;
    }

    stats.runEndTime = Date.now();
    stats.completionReason = reason;
    stats.completionPercent = normalizeCompletionPercent(
        options.completionPercent ?? stats.completionPercent
    );
    stats.dungeonCompleted = Boolean(options.dungeonCompleted) || reason === 'success';

    if (stats.scoreMode === 'pending') {
        promotePendingRunToDungeonClear(stats);
    }

    let unresolvedShotCount = 0;
    for (const shot of stats.pendingShots.values()) {
        if (!shot.resolved) {
            unresolvedShotCount++;
            shot.resolved = true;
        }
    }
    stats.missedShots += unresolvedShotCount;
    stats.totalShots = Math.max(stats.totalShots, stats.successfulHits + stats.missedShots);
    const accumulator = stats.windowAccumulator;
    applyFallbackObjectiveProgress(stats);
    refreshAccumulatorFields(accumulator, stats.dungeonCompleted, stats.completionPercent);
    syncStatsFromAccumulator(stats);
    stats.elapsedMs = getScoredElapsedMs(stats);
    recordDungeonRunEvent(stats, 'finalize', {
        value: stats.scoreSummary.finalStat.total,
        note: reason
    });
    const finalized: DungeonRunFinalizedStats = {
        dungeonId: stats.dungeonId,
        levelName: stats.levelName,
        levelScope: stats.levelScope,
        runStartTime: stats.runStartTime,
        entryStartTime: stats.entryStartTime,
        scoreWindowStartTime: stats.scoreWindowStartTime,
        accuracyWindowStartTime: stats.accuracyWindowStartTime,
        runEndTime: stats.runEndTime,
        elapsedMs: stats.elapsedMs,
        playerDeaths: stats.playerDeaths,
        totalEnemiesEligible: stats.totalEnemiesEligible,
        killedEnemies: stats.killedEnemies,
        skippedEnemies: stats.skippedEnemies,
        totalChestsEligible: stats.totalChestsEligible,
        openedChests: stats.openedChests,
        totalShots: stats.totalShots,
        successfulHits: stats.successfulHits,
        missedShots: stats.missedShots,
        accuracyRatio: stats.accuracyRatio,
        totalObjectivesEligible: stats.totalObjectivesEligible,
        completedObjectives: stats.completedObjectives,
        failedObjectives: stats.failedObjectives,
        bossKilled: stats.bossKilled,
        bossFightStartTime: stats.bossFightStartTime,
        bossDefeatTime: stats.bossDefeatTime,
        dungeonCompleted: stats.dungeonCompleted,
        runClassification: stats.runClassification,
        scoreMode: stats.scoreMode,
        scoreSummary: stats.scoreSummary,
        completionReason: stats.completionReason,
        treasureGold: stats.treasureGold,
        completionPercent: stats.completionPercent,
        accuracyWindowSource: stats.accuracyWindowSource,
        eventLedger: stats.eventLedger.map((entry) => ({ ...entry }))
    };

    stats.finalizedAt = finalized.runEndTime;
    stats.finalizedStats = finalized;
    if (DUNGEON_RUN_DEBUG_ENABLED) {
        console.log(`[DungeonRunTracker] ${JSON.stringify(getDungeonRunDebugSnapshot(client) ?? finalized)}`);
    }
    return finalized;
}

export function noteDungeonRunBossCutscene(
    levelScope: string | null | undefined,
    roomId: number,
    bossId?: number | null
): void {
    const normalizedScope = String(levelScope ?? '').trim();
    if (!normalizedScope) {
        return;
    }

    for (const session of GlobalState.sessionsByToken.values()) {
        if (!session.playerSpawned || getClientLevelScope(session) !== normalizedScope) {
            continue;
        }

        const stats = getActiveDungeonRunStats(session);
        if (!stats || stats.finalizedAt) {
            continue;
        }

        stats.bossCutsceneTriggeredAt ??= Date.now();
        if (stats.scoreMode === 'pending' && !stats.preBossEncounterEngaged) {
            activateBossRunScoreWindow(stats, session, roomId, bossId);
        } else {
            recordDungeonRunEvent(stats, 'boss_cutscene', {
                roomId
            });
        }
    }
}

export function buildDungeonRunScoreSummary(stats: DungeonRunStats): DungeonRunScoreSummary {
    const profile = getDungeonScoreProfile(stats.levelName) ?? buildDefaultDungeonScoreProfile(stats.levelName);
    const totalEnemyNodes = stats.windowAccumulator.eligibleEnemyIds.size;
    const completedEnemyNodes = stats.windowAccumulator.killedEnemyIds.size;
    const totalChestNodes = stats.windowAccumulator.eligibleChestIds.size;
    const completedChestNodes = stats.windowAccumulator.openedChestIds.size;
    const totalObjectiveNodes = stats.windowAccumulator.eligibleObjectiveIds.size;
    const completedObjectiveNodes = stats.windowAccumulator.completedObjectiveIds.size;
    const progressionNodesTotal = totalEnemyNodes + totalChestNodes + totalObjectiveNodes;
    const progressionNodesCompleted = completedEnemyNodes + completedChestNodes + completedObjectiveNodes;
    const enemyRatio = totalEnemyNodes > 0 ? clampRatio(completedEnemyNodes / totalEnemyNodes) : 0;
    const chestRatio = totalChestNodes > 0 ? clampRatio(completedChestNodes / totalChestNodes) : 0;
    const accuracyRatio = clampRatio(stats.totalShots > 0 ? stats.successfulHits / stats.totalShots : 0);
    const killCap = stats.scoreMode === 'boss_run'
        ? LIVE_BOSS_RUN_KILL_CAP
        : profile.killCap;
    const treasureCap = profile.treasureCap;
    const timeBonusCap = profile.timeBonusCap;
    const elapsedMs = getScoredElapsedMs(stats);

    const unlockedCap: DungeonRunScoreBudget = {
        kills: Math.max(0, Math.round(killCap)),
        treasure: Math.max(0, Math.round(treasureCap)),
        accuracy: LIVE_ACCURACY_CAP,
        deaths: LIVE_DEATHS_BASE,
        timeBonus: Math.max(0, Math.round(timeBonusCap)),
        total: 0
    };
    unlockedCap.total =
        unlockedCap.kills +
        unlockedCap.treasure +
        unlockedCap.accuracy +
        unlockedCap.deaths +
        unlockedCap.timeBonus;

    const rawEarned: DungeonRunScoreBudget = {
        kills: Math.round(killCap * enemyRatio),
        treasure: totalChestNodes > 0
            ? Math.round(treasureCap * chestRatio)
            : stats.treasureGold > 0
                ? Math.min(treasureCap, Math.round(stats.treasureGold))
                : 0,
        accuracy: Math.round(LIVE_ACCURACY_CAP * accuracyRatio),
        deaths: calculateDeathsScore(stats.levelName, stats.playerDeaths),
        timeBonus: calculateTimeBonusScore(stats.levelName, stats.scoreMode, timeBonusCap, elapsedMs),
        total: 0
    };
    rawEarned.total =
        rawEarned.kills +
        rawEarned.treasure +
        rawEarned.accuracy +
        rawEarned.deaths +
        rawEarned.timeBonus;

    const finalStat: DungeonRunScoreBudget = {
        kills: Math.max(0, Math.min(rawEarned.kills, unlockedCap.kills)),
        treasure: Math.max(0, Math.min(rawEarned.treasure, unlockedCap.treasure)),
        accuracy: Math.max(0, Math.min(rawEarned.accuracy, unlockedCap.accuracy)),
        deaths: Math.max(0, Math.min(rawEarned.deaths, unlockedCap.deaths)),
        timeBonus: Math.max(0, Math.min(rawEarned.timeBonus, unlockedCap.timeBonus)),
        total: 0
    };
    finalStat.total =
        finalStat.kills +
        finalStat.treasure +
        finalStat.accuracy +
        finalStat.deaths +
        finalStat.timeBonus;

    const maxTotalScore = unlockedCap.total;
    const stars = Math.max(0, Math.min(10, Math.round((finalStat.total / Math.max(1, maxTotalScore)) * 10)));
    const rank = Math.max(1, Math.min(10, 11 - stars));

    return {
        profile,
        progressionNodesTotal,
        progressionNodesCompleted,
        enemyNodesTotal: totalEnemyNodes,
        enemyNodesCompleted: completedEnemyNodes,
        chestNodesTotal: totalChestNodes,
        chestNodesCompleted: completedChestNodes,
        objectiveNodesTotal: totalObjectiveNodes,
        objectiveNodesCompleted: completedObjectiveNodes,
        unlockedCap,
        rawEarned,
        finalStat,
        stars,
        rank,
        resultBar: profile.resultBar
    };
}

export function getDungeonRunDebugSnapshot(client: Client): DungeonRunDebugSnapshot | null {
    const stats = getActiveDungeonRunStats(client);
    if (!stats) {
        return null;
    }

    return {
        dungeonId: stats.dungeonId,
        runInstanceId: stats.levelScope,
        finalized: Boolean(stats.finalizedAt),
        completionState: stats.completionReason,
        finalizedSource: stats.finalizedStats ? 'finalized_tracker_snapshot' : 'live_tracker_state',
        bossKilled: stats.bossKilled,
        runClassification: classifyDungeonRun(stats),
        scoreMode: stats.scoreMode,
        scoreWindowStartTime: stats.scoreWindowStartTime,
        bossCutsceneTriggeredAt: stats.bossCutsceneTriggeredAt,
        eligibleEnemyCount: stats.totalEnemiesEligible,
        killedEnemyCount: stats.killedEnemies,
        missingEnemyIds: getMissingIds(stats.eligibleEnemyIds, stats.killedEnemyIds),
        eligibleChestCount: stats.totalChestsEligible,
        openedChestCount: stats.openedChests,
        missingChestIds: getMissingIds(stats.eligibleChestIds, stats.openedChestIds),
        totalShots: stats.totalShots,
        successfulShots: stats.successfulHits,
        missedShots: stats.missedShots,
        accuracyRatio: stats.accuracyRatio,
        playerDeaths: stats.playerDeaths,
        elapsedMs: stats.elapsedMs
    };
}
