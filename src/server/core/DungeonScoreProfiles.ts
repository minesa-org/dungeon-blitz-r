import {
    buildCustomFallbackDungeonStatCaps,
    getDungeonStatCaps,
    getDungeonStatTotalCap
} from './DungeonStatCaps';

export type DungeonScoreProfile = {
    killCap: number;
    treasureCap: number;
    accuracyCap: number;
    deathCap: number;
    timeBonusCap: number;
};

export type ResolvedDungeonScoreProfile = DungeonScoreProfile & {
    resultBar: number;
};

export function getDungeonScoreProfile(levelName: string): ResolvedDungeonScoreProfile | null {
    const caps = getDungeonStatCaps(levelName);
    if (!caps) {
        return null;
    }

    return {
        killCap: caps.killCap,
        treasureCap: caps.treasureCap,
        accuracyCap: caps.accuracyCap,
        deathCap: caps.deathCap,
        timeBonusCap: caps.timeBonusCap,
        resultBar: caps.resultBar
    };
}

export function buildDefaultDungeonScoreProfile(levelName: string): ResolvedDungeonScoreProfile {
    const fallback = buildCustomFallbackDungeonStatCaps(levelName);
    return {
        killCap: fallback.killCap,
        treasureCap: fallback.treasureCap,
        accuracyCap: fallback.accuracyCap,
        deathCap: fallback.deathCap,
        timeBonusCap: fallback.timeBonusCap,
        resultBar: fallback.resultBar
    };
}

export function getDungeonScoreTotalCap(profile: DungeonScoreProfile): number {
    return getDungeonStatTotalCap(profile);
}
