import fs from 'fs';
import path from 'path';

export interface MissionDef {
    MissionName: string;
    MissionID: number;
    Tier?: boolean;
    Time?: boolean;
    highscore?: number;
    CompleteCount?: number;
    ReturnName?: string;
}

export class MissionLoader {
    private static missions: Map<number, MissionDef> = new Map();
    private static maxId: number = 0;

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

    static load(dataDir: string): void {
        const filePath = path.join(dataDir, 'MissionTypes.json');
        try {
            const data = fs.readFileSync(filePath, 'utf8');
            const json = JSON.parse(data);
            
            for (const item of json) {
                const id = parseInt(item.MissionID);
                if (!isNaN(id)) {
                    const completeCount = Math.max(1, parseInt(item.CompleteCount ?? "1", 10) || 1);
                    this.missions.set(id, {
                        MissionName: item.MissionName,
                        MissionID: id,
                        Tier: this.isTruthy(item.Achievement),
                        Time: this.isTruthy(item.Timed) || Boolean(item.Dungeon),
                        highscore: completeCount,
                        CompleteCount: completeCount,
                        ReturnName: item.ReturnName || ""
                    });
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

    static getTotalMissions(): number {
        return this.maxId;
    }
}
