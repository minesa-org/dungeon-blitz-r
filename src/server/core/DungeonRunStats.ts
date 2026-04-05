import { Client } from './Client';
import { GlobalState } from './GlobalState';
import { LevelConfig } from './LevelConfig';
import { getClientLevelScope } from './LevelScope';
import { getClientCharacterKey } from './PartySync';

export interface DungeonRunStats {
    levelName: string;
    levelScope: string;
    startedAt: number;
    powerCasts: number;
    landedHits: number;
    kills: number;
    treasureGold: number;
    deaths: number;
}

function createDungeonRunStats(client: Client, levelName: string, levelScope: string): DungeonRunStats {
    return {
        levelName,
        levelScope,
        startedAt: Date.now(),
        powerCasts: 0,
        landedHits: 0,
        kills: 0,
        treasureGold: 0,
        deaths: 0
    };
}

export function cloneDungeonRunStats(stats: DungeonRunStats | null | undefined): DungeonRunStats | null {
    return stats ? { ...stats } : null;
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

export function noteDungeonRunCast(client: Client): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats) {
        return;
    }

    stats.powerCasts += 1;
}

export function noteDungeonRunHit(client: Client): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats) {
        return;
    }

    stats.landedHits += 1;
}

export function noteDungeonRunTreasure(client: Client, gold: number): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats) {
        return;
    }

    stats.treasureGold += Math.max(0, Math.round(Number(gold) || 0));
}

export function noteDungeonRunDeath(client: Client): void {
    const stats = getActiveDungeonRunStats(client);
    if (!stats) {
        return;
    }

    stats.deaths += 1;
}

export function noteDungeonRunKill(levelScope: string | null | undefined, contributorKeys: string[]): void {
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
            stats.kills += 1;
        }
        remainingKeys.delete(characterKey);

        if (!remainingKeys.size) {
            break;
        }
    }
}
