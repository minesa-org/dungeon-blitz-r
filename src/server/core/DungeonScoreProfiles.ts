import { LevelConfig } from './LevelConfig';

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

type CalibratedDungeonScoreProfile = {
    observedName: string;
    resultBar: number;
    profile: DungeonScoreProfile;
};

// Calibrated fallback bucket caps derived from observed result screens.
// These are temporary per-dungeon caps, not claims about the original formula.
const CALIBRATED_DUNGEON_SCORE_PROFILES: Record<string, CalibratedDungeonScoreProfile> = {
    TutorialDungeon: {
        observedName: 'GoblinKidnappers',
        resultBar: 2,
        profile: {
            killCap: 80000,
            treasureCap: 20000,
            accuracyCap: 40000,
            deathCap: 40000,
            timeBonusCap: 40000
        }
    },
    TutorialDungeonHard: {
        observedName: 'GoblinKidnappers',
        resultBar: 2,
        profile: {
            killCap: 80000,
            treasureCap: 20000,
            accuracyCap: 40000,
            deathCap: 40000,
            timeBonusCap: 40000
        }
    },
    CraftTownTutorial: {
        observedName: 'GoblinCamp',
        resultBar: 3,
        profile: {
            killCap: 120000,
            treasureCap: 30000,
            accuracyCap: 60000,
            deathCap: 60000,
            timeBonusCap: 60000
        }
    },
    GhostBossDungeon: {
        observedName: 'NephitsQuest',
        resultBar: 4,
        profile: {
            killCap: 160000,
            treasureCap: 40000,
            accuracyCap: 80000,
            deathCap: 80000,
            timeBonusCap: 80000
        }
    },
    DreamDragonDungeon: {
        observedName: 'TheDragonsDream',
        resultBar: 5,
        profile: {
            killCap: 200000,
            treasureCap: 50000,
            accuracyCap: 100000,
            deathCap: 100000,
            timeBonusCap: 100000
        }
    }
};

export function getDungeonScoreProfile(levelName: string): ResolvedDungeonScoreProfile | null {
    const normalizedLevel = LevelConfig.normalizeLevelName(levelName);
    if (!normalizedLevel) {
        return null;
    }

    const calibrated = CALIBRATED_DUNGEON_SCORE_PROFILES[normalizedLevel];
    if (!calibrated) {
        return null;
    }

    return {
        ...calibrated.profile,
        resultBar: calibrated.resultBar
    };
}

export function buildDefaultDungeonScoreProfile(levelName: string): ResolvedDungeonScoreProfile {
    const scoreScale = LevelConfig.get(levelName).isHard ? 2 : 1;
    return {
        killCap: 40000 * scoreScale,
        treasureCap: 10000 * scoreScale,
        accuracyCap: 20000 * scoreScale,
        deathCap: 20000 * scoreScale,
        timeBonusCap: 10000 * scoreScale,
        resultBar: LevelConfig.get(levelName).isHard ? 2 : 1
    };
}

export function getDungeonScoreTotalCap(profile: DungeonScoreProfile): number {
    return profile.killCap
        + profile.treasureCap
        + profile.accuracyCap
        + profile.deathCap
        + profile.timeBonusCap;
}
