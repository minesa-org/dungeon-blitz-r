import fs from 'fs';
import path from 'path';

export interface MissionDef {
    MissionName: string;
    MissionID: number;
    DisplayName?: string;
    OfferText?: string;
    ActiveText?: string;
    ActiveTarget?: string;
    ProgressIcon?: string;
    ProgressText?: string;
    Tier?: boolean;
    Time?: boolean;
    highscore?: number;
    CompleteCount?: number;
    ReturnName?: string;
    ReturnText?: string;
    PraiseText?: string;
    ContactName?: string;
    Dungeon?: string;
    Priority?: string;
    ZoneSet?: string;
    MissionLevel?: number;
    PreReqMissions?: string[];
    ExpReward?: string;
    GoldReward?: string;
    ExpRewardValue?: number;
    GoldRewardValue?: number;
}

export class MissionLoader {
    private static missions: Map<number, MissionDef> = new Map();
    private static missionIdsByName: Map<string, number> = new Map();
    private static maxId: number = 0;

    private static readonly MISSION_EXP_REWARD_TABLE: readonly number[] = [
        0, 10, 24, 38, 52, 71, 92, 114, 141, 175, 211, 253, 303,
        360, 426, 500, 589, 693, 807, 943, 1103, 1288, 1497, 1747,
        2029, 2353, 2734, 3165, 3670, 4251, 4923, 5696, 6587, 7621,
        8808, 10182, 11760, 13585, 15685, 18111, 20898, 24116, 27819,
        32085, 37002, 42667, 49187, 56702, 65347, 75308, 86780
    ];

    private static readonly MISSION_GOLD_REWARD_TABLE: readonly number[] = [
        0, 43, 84, 123, 163, 204, 244, 284, 329, 375, 421, 473, 526,
        579, 645, 706, 774, 850, 927, 1011, 1103, 1197, 1306, 1416,
        1535, 1662, 1805, 1950, 2111, 2282, 2462, 2658, 2872, 3096,
        3337, 3603, 3880, 4183, 4503, 4851, 5224, 5625, 6053, 6516,
        7007, 7542, 8113, 8729, 9381, 10087, 10847
    ];

    private static readonly LOW_EXP_REWARD_TABLE: readonly number[] = [
        0, 2, 5, 8, 10, 14, 18, 23, 28, 35, 42, 51, 61, 72, 85, 100,
        118, 139, 161, 189, 221, 258, 299, 349, 406, 471, 547, 633,
        734, 850, 985, 1139, 1317, 1524, 1762, 2036, 2352, 2717, 3137,
        3622, 4180, 4823, 5564, 6417, 7400, 8533, 9837, 11340, 13069,
        15062, 17356
    ];

    private static readonly LOW_GOLD_REWARD_TABLE: readonly number[] = [
        0, 9, 17, 25, 33, 41, 49, 57, 66, 75, 84, 95, 105, 116, 129,
        141, 155, 170, 185, 202, 221, 239, 261, 283, 307, 332, 361,
        390, 422, 456, 492, 532, 574, 619, 667, 721, 776, 837, 901,
        970, 1045, 1125, 1211, 1303, 1401, 1508, 1623, 1746, 1876,
        2017, 2169
    ];

    private static parseNumericReward(value: string): number | null {
        const trimmed = String(value ?? '').trim();
        const parsed = parseInt(trimmed, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    }

    private static readRewardTableValue(table: readonly number[], missionLevel: number): number {
        const level = Math.max(0, Math.round(Number(missionLevel ?? 0)));
        const index = Math.min(level, table.length - 1);
        return Math.max(0, Number(table[index] ?? 0));
    }

    private static resolveSymbolicReward(
        rawValue: unknown,
        missionLevel: number,
        rewardTable: readonly number[],
        lowRewardTable: readonly number[]
    ): number {
        const numeric = MissionLoader.parseNumericReward(String(rawValue ?? ''));
        if (numeric !== null) {
            return numeric;
        }

        const key = String(rawValue ?? '').toUpperCase().trim();
        if (key === 'M') {
            return MissionLoader.readRewardTableValue(rewardTable, missionLevel);
        }
        if (key === 'L' || key === 'S') {
            return MissionLoader.readRewardTableValue(lowRewardTable, missionLevel);
        }

        return 0;
    }

    private static isTruthy(value: unknown): boolean {
        if (typeof value === 'boolean') {
            return value;
        }
        if (value === null || value === undefined) {
            return false;
        }

        const normalized = String(value).trim().toLowerCase();
        return ["1", "true", "yes", "y", "t"].includes(normalized);
    }

    private static normalizeMissionName(value: unknown): string {
        return String(value ?? "").trim().toLowerCase();
    }

    static load(dataDir: string): void {
        const filePath = path.join(dataDir, 'MissionTypes.json');
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(data);

            this.missions.clear();
            this.missionIdsByName.clear();
            this.maxId = 0;
            
            for (const item of json) {
                const id = parseInt(item.MissionID);
                if (!isNaN(id)) {
                    const parsedCompleteCount = parseInt(item.CompleteCount ?? "1", 10);
                    const completeCount = Number.isFinite(parsedCompleteCount)
                        ? Math.max(0, parsedCompleteCount)
                        : 1;
                    const missionName = String(item.MissionName ?? "").trim();
                    const preReqMissions = String(item.PreReqMissions ?? "")
                        .split(",")
                        .map((entry) => entry.trim())
                        .filter(Boolean);

                    const missionLevel = parseInt(item.MissionLevel ?? "0", 10) || 0;

                    const expRewardValue = MissionLoader.resolveSymbolicReward(
                        item.ExpReward,
                        missionLevel,
                        MissionLoader.MISSION_EXP_REWARD_TABLE,
                        MissionLoader.LOW_EXP_REWARD_TABLE
                    );
                    const goldRewardValue = MissionLoader.resolveSymbolicReward(
                        item.GoldReward,
                        missionLevel,
                        MissionLoader.MISSION_GOLD_REWARD_TABLE,
                        MissionLoader.LOW_GOLD_REWARD_TABLE
                    );

                    this.missions.set(id, {
                        MissionName: missionName,
                        MissionID: id,
                        DisplayName: item.DisplayName || "",
                        OfferText: item.OfferText || "",
                        ActiveText: item.ActiveText || "",
                        ActiveTarget: item.ActiveTarget || "",
                        ProgressIcon: item.ProgressIcon || "",
                        ProgressText: item.ProgressText || "",
                        Tier: this.isTruthy(item.Achievement),
                        Time: this.isTruthy(item.Timed) || Boolean(item.Dungeon),
                        highscore: completeCount,
                        CompleteCount: completeCount,
                        ReturnName: item.ReturnName || "",
                        ReturnText: item.ReturnText || "",
                        PraiseText: item.PraiseText || "",
                        ContactName: item.ContactName || "",
                        Dungeon: item.Dungeon || "",
                        Priority: item.Priority || "",
                        ZoneSet: item.ZoneSet || "",
                        MissionLevel: missionLevel,
                        PreReqMissions: preReqMissions,
                        ExpReward: item.ExpReward || "",
                        GoldReward: item.GoldReward || "",
                        ExpRewardValue: expRewardValue,
                        GoldRewardValue: goldRewardValue
                    });
                    const normalizedName = this.normalizeMissionName(missionName);
                    if (normalizedName) {
                        this.missionIdsByName.set(normalizedName, id);
                    }
                    if (id > this.maxId) this.maxId = id;
                }
            }
            console.log(`[MissionLoader] Loaded ${this.missions.size} missions. Max ID: ${this.maxId}`);
        } catch (e) {
            console.error(`[MissionLoader] Failed to load missions: ${e}`);
        }
    }

    static getMissionDef(id: number): MissionDef | undefined {
        // if (this.missions.size === 0) this.load(); // Cannot lazy load without dataDir
        return this.missions.get(id);
    }

    static getMissionIdByName(name: string): number | undefined {
        return this.missionIdsByName.get(this.normalizeMissionName(name));
    }

    static findPrimaryMissionByDungeon(levelName: string): MissionDef | undefined {
        const normalizedLevel = String(levelName ?? '').trim();
        if (!normalizedLevel) {
            return undefined;
        }

        for (const mission of this.missions.values()) {
            if (String(mission.Dungeon ?? '').trim() === normalizedLevel) {
                return mission;
            }
        }

        return undefined;
    }

    static getTotalMissions(): number {
        return this.maxId;
    }
}
