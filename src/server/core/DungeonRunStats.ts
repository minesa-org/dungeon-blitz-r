import { Client } from './Client';
import { EntityTeam } from './Entity';
import { GameData } from './GameData';
import { GlobalState } from './GlobalState';
import { LevelConfig } from './LevelConfig';
import { getClientLevelScope } from './LevelScope';
import { getClientCharacterKey } from './PartySync';
import { NpcLoader } from '../data/NpcLoader';

export type DungeonRunCompletionReason = 'success' | 'fail' | 'leave' | 'abort' | 'unknown';

type PendingShot = {
    key: string;
    projectileId: number | null;
    createdAt: number;
    resolved: boolean;
};

export type DungeonRunFinalizedStats = {
    dungeonId: string;
    levelName: string;
    levelScope: string;
    runStartTime: number;
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
    dungeonCompleted: boolean;
    completionReason: DungeonRunCompletionReason;
    treasureGold: number;
    completionPercent: number;
};

export type DungeonRunDebugSnapshot = {
    dungeonId: string;
    runInstanceId: string;
    finalized: boolean;
    completionState: DungeonRunCompletionReason;
    finalizedSource: string;
    bossKilled: boolean;
    eligibleEnemyCount: number;
    killedEnemyCount: number;
    missingEnemyIds: number[];
    eligibleChestCount: number;
    openedChestCount: number;
    missingChestIds: number[];
    totalShots: number;
    successfulShots: number;
    missedShots: number;
    playerDeaths: number;
    elapsedMs: number;
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

function refreshAggregateFields(stats: DungeonRunStats): void {
    stats.totalEnemiesEligible = stats.eligibleEnemyIds.size;
    stats.killedEnemies = stats.killedEnemyIds.size;
    stats.skippedEnemies = Math.max(0, stats.totalEnemiesEligible - stats.killedEnemies);
    stats.totalChestsEligible = stats.eligibleChestIds.size;
    stats.openedChests = stats.openedChestIds.size;
    stats.totalObjectivesEligible = stats.eligibleObjectiveIds.size;
    stats.completedObjectives = stats.completedObjectiveIds.size;
    stats.failedObjectives = Math.max(
        stats.failedObjectiveIds.size,
        stats.totalObjectivesEligible - stats.completedObjectives
    );
    stats.accuracyRatio = stats.totalShots > 0
        ? clampRatio(stats.successfulHits / stats.totalShots)
        : 0;
}

function applyFallbackObjectiveProgress(stats: DungeonRunStats): void {
    if (stats.totalObjectivesEligible > 0) {
        return;
    }

    if (stats.completionPercent <= 0 && !stats.dungeonCompleted) {
        return;
    }

    stats.totalObjectivesEligible = 1;
    if (stats.dungeonCompleted || stats.completionPercent >= 100) {
        stats.completedObjectives = 1;
        stats.failedObjectives = 0;
    } else {
        stats.completedObjectives = 0;
        stats.failedObjectives = 1;
    }
}

function createDungeonRunStats(client: Client, levelName: string, levelScope: string): DungeonRunStats {
    const now = Date.now();
    const stats: DungeonRunStats = {
        dungeonId: levelScope,
        levelName,
        levelScope,
        runStartTime: now,
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
        dungeonCompleted: false,
        completionReason: 'unknown',
        treasureGold: 0,
        completionPercent: 0,
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
        finalizedAt: null,
        finalizedStats: null
    };

    for (const npc of NpcLoader.getRawNpcsForLevel(levelName)) {
        noteDungeonRunEntity(stats, Number(npc?.id ?? 0), npc);
    }

    refreshAggregateFields(stats);
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

function findOldestPendingShot(stats: DungeonRunStats): PendingShot | null {
    for (const shot of stats.pendingShots.values()) {
        if (!shot.resolved) {
            return shot;
        }
    }

    return null;
}

function resolvePendingShotAsHit(stats: DungeonRunStats): boolean {
    const shot = findOldestPendingShot(stats);
    if (!shot) {
        return false;
    }

    shot.resolved = true;
    stats.successfulHits += 1;
    return true;
}

function noteDungeonRunEntity(stats: DungeonRunStats, entityId: number, entity: any): void {
    if (!entityId || !entity || stats.finalizedAt) {
        return;
    }

    const kind = classifyDungeonRunEntity(entity);
    if (kind.enemy) {
        stats.eligibleEnemyIds.add(entityId);
    }
    if (kind.boss) {
        stats.bossEnemyIds.add(entityId);
    }
    if (kind.chest) {
        stats.eligibleChestIds.add(entityId);
    }
    if (kind.objective) {
        stats.eligibleObjectiveIds.add(entityId);
    }

    refreshAggregateFields(stats);
}

export function cloneDungeonRunStats(stats: DungeonRunStats | null | undefined): DungeonRunStats | null {
    if (!stats) {
        return null;
    }

    return {
        ...stats,
        finalizedStats: stats.finalizedStats
            ? {
                ...stats.finalizedStats
            }
            : null,
        eligibleEnemyIds: cloneSet(stats.eligibleEnemyIds),
        killedEnemyIds: cloneSet(stats.killedEnemyIds),
        bossEnemyIds: cloneSet(stats.bossEnemyIds),
        eligibleChestIds: cloneSet(stats.eligibleChestIds),
        openedChestIds: cloneSet(stats.openedChestIds),
        eligibleObjectiveIds: cloneSet(stats.eligibleObjectiveIds),
        completedObjectiveIds: cloneSet(stats.completedObjectiveIds),
        failedObjectiveIds: cloneSet(stats.failedObjectiveIds),
        pendingShots: clonePendingShots(stats.pendingShots)
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

    stats.totalShots += 1;
    const shotKey = context.projectileId !== null
        ? `projectile:${context.projectileId}`
        : `cast:${++stats.nextShotSequence}`;
    stats.pendingShots.set(shotKey, {
        key: shotKey,
        projectileId: context.projectileId,
        createdAt: Date.now(),
        resolved: false
    });
    refreshAggregateFields(stats);
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

    if (kind.objective) {
        stats.completedObjectiveIds.add(context.targetId);
    }

    resolvePendingShotAsHit(stats);
    refreshAggregateFields(stats);
}

export function noteDungeonRunTreasure(client: Client, gold: number): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt) {
        return;
    }

    stats.treasureGold += Math.max(0, Math.round(Number(gold) || 0));
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

    stats.openedChestIds.add(sourceId);
    refreshAggregateFields(stats);
}

export function noteDungeonRunDeath(client: Client): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt) {
        return;
    }

    stats.playerDeaths += 1;
    refreshAggregateFields(stats);
}

export function noteDungeonRunCompletionProgress(client: Client, completionPercent: number): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats || stats.finalizedAt) {
        return;
    }

    stats.completionPercent = normalizeCompletionPercent(completionPercent);
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
                if (kind.enemy) {
                    stats.killedEnemyIds.add(entityId);
                }
                if (kind.boss) {
                    stats.bossKilled = true;
                }
                if (kind.objective) {
                    stats.completedObjectiveIds.add(entityId);
                }
                refreshAggregateFields(stats);
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
    stats.elapsedMs = Math.max(0, stats.runEndTime - stats.runStartTime);
    stats.completionReason = reason;
    stats.completionPercent = normalizeCompletionPercent(
        options.completionPercent ?? stats.completionPercent
    );
    stats.dungeonCompleted = Boolean(options.dungeonCompleted) || reason === 'success';

    let unresolvedShotCount = 0;
    for (const shot of stats.pendingShots.values()) {
        if (!shot.resolved) {
            unresolvedShotCount++;
            shot.resolved = true;
        }
    }
    stats.missedShots += unresolvedShotCount;
    stats.totalShots = Math.max(stats.totalShots, stats.successfulHits + stats.missedShots);
    applyFallbackObjectiveProgress(stats);
    refreshAggregateFields(stats);

    const finalized: DungeonRunFinalizedStats = {
        dungeonId: stats.dungeonId,
        levelName: stats.levelName,
        levelScope: stats.levelScope,
        runStartTime: stats.runStartTime,
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
        dungeonCompleted: stats.dungeonCompleted,
        completionReason: stats.completionReason,
        treasureGold: stats.treasureGold,
        completionPercent: stats.completionPercent
    };

    stats.finalizedAt = finalized.runEndTime;
    stats.finalizedStats = finalized;
    if (DUNGEON_RUN_DEBUG_ENABLED) {
        console.log(`[DungeonRunTracker] ${JSON.stringify(getDungeonRunDebugSnapshot(client) ?? finalized)}`);
    }
    return finalized;
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
        eligibleEnemyCount: stats.totalEnemiesEligible,
        killedEnemyCount: stats.killedEnemies,
        missingEnemyIds: getMissingIds(stats.eligibleEnemyIds, stats.killedEnemyIds),
        eligibleChestCount: stats.totalChestsEligible,
        openedChestCount: stats.openedChests,
        missingChestIds: getMissingIds(stats.eligibleChestIds, stats.openedChestIds),
        totalShots: stats.totalShots,
        successfulShots: stats.successfulHits,
        missedShots: stats.missedShots,
        playerDeaths: stats.playerDeaths,
        elapsedMs: stats.elapsedMs
    };
}
