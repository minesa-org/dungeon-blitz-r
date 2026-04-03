import fs from 'fs';
import path from 'path';
import { Character } from '../database/Database';
import { normalizeDialogueLinesForClient } from './DialogueTextNormalizer';

type RawDialogueCondition = {
    missionId?: number;
    minState?: number;
    maxState?: number;
    lines?: string[];
};

type RawDialogueEntry = {
    displayName?: string;
    defaultLines?: string[];
    conditionalLines?: RawDialogueCondition[];
};

type RawDialogueFile = {
    levels?: Record<string, Record<string, RawDialogueEntry>>;
};

export interface NpcDialogueCondition {
    missionId?: number;
    minState?: number;
    maxState?: number;
    lines: string[];
}

export interface NpcDialogueEntry {
    displayName?: string;
    defaultLines: string[];
    conditionalLines: NpcDialogueCondition[];
}

type DialogueLevels = Map<string, Map<string, NpcDialogueEntry>>;

export class NpcDialogueLoader {
    private static readonly DEFAULT_LOCALE = 'en';
    private static readonly MISSION_NOT_STARTED = 0;
    private static localizedLevels: Map<string, DialogueLevels> = new Map();
    private static loaded = false;

    private static normalizeLevelName(levelName: string): string {
        return String(levelName ?? '').trim();
    }

    private static resolveFallbackLevelName(levels: DialogueLevels, levelName: string): string | null {
        const normalized = this.normalizeLevelName(levelName);
        if (!normalized.endsWith('Hard')) {
            return null;
        }

        const baseLevel = normalized.slice(0, -4);
        return levels.has(baseLevel) ? baseLevel : null;
    }

    private static normalizeLocale(locale: string): string {
        const normalized = String(locale ?? '').trim().toLowerCase();
        return normalized || this.DEFAULT_LOCALE;
    }

    private static normalizeNpcKey(npcKey: string): string {
        return String(npcKey ?? '').trim().toLowerCase();
    }

    private static sanitizeLines(lines: unknown): string[] {
        if (!Array.isArray(lines)) {
            return [];
        }

        const unique: string[] = [];
        for (const line of lines) {
            const normalized = String(line ?? '').trim();
            if (!normalized || unique.includes(normalized)) {
                continue;
            }
            unique.push(normalized);
        }

        return unique;
    }

    private static normalizeCondition(raw: RawDialogueCondition): NpcDialogueCondition | null {
        const lines = this.sanitizeLines(raw?.lines);
        if (!lines.length) {
            return null;
        }

        const missionId = Number(raw?.missionId ?? 0);
        const minState = raw?.minState == null ? undefined : Number(raw.minState);
        const maxState = raw?.maxState == null ? undefined : Number(raw.maxState);

        return {
            missionId: missionId > 0 ? missionId : undefined,
            minState: Number.isFinite(minState) ? minState : undefined,
            maxState: Number.isFinite(maxState) ? maxState : undefined,
            lines
        };
    }

    private static normalizeEntry(raw: RawDialogueEntry): NpcDialogueEntry | null {
        const defaultLines = this.sanitizeLines(raw?.defaultLines);
        const conditionalLines = Array.isArray(raw?.conditionalLines)
            ? raw.conditionalLines
                .map((condition) => this.normalizeCondition(condition))
                .filter((condition): condition is NpcDialogueCondition => Boolean(condition))
            : [];

        if (!defaultLines.length && !conditionalLines.length) {
            return null;
        }

        return {
            displayName: String(raw?.displayName ?? '').trim() || undefined,
            defaultLines,
            conditionalLines
        };
    }

    private static getMissionState(character: Character | null | undefined, missionId: number): number {
        if (!character?.missions || typeof character.missions !== 'object' || Array.isArray(character.missions)) {
            return this.MISSION_NOT_STARTED;
        }

        const entry = (character.missions as Record<string, Record<string, unknown>>)[String(missionId)];
        return Number((entry && typeof entry === 'object' ? entry.state : undefined) ?? this.MISSION_NOT_STARTED);
    }

    private static matchesCondition(
        character: Character | null | undefined,
        condition: NpcDialogueCondition
    ): boolean {
        if (!condition.missionId) {
            return true;
        }

        const state = this.getMissionState(character, condition.missionId);
        if (condition.minState != null && state < condition.minState) {
            return false;
        }
        if (condition.maxState != null && state > condition.maxState) {
            return false;
        }

        return true;
    }

    private static resolveEntry(levelName: string, npcKey: string, locale: string): NpcDialogueEntry | null {
        const normalizedLocale = this.normalizeLocale(locale);
        const normalizedLevel = this.normalizeLevelName(levelName);
        const normalizedNpcKey = this.normalizeNpcKey(npcKey);
        const localesToCheck = normalizedLocale === this.DEFAULT_LOCALE
            ? [this.DEFAULT_LOCALE]
            : [normalizedLocale, this.DEFAULT_LOCALE];

        for (const localeKey of localesToCheck) {
            const levels = this.localizedLevels.get(localeKey);
            if (!levels) {
                continue;
            }

            const direct = levels.get(normalizedLevel)?.get(normalizedNpcKey);
            if (direct) {
                return direct;
            }

            const fallbackLevel = this.resolveFallbackLevelName(levels, normalizedLevel);
            if (!fallbackLevel) {
                continue;
            }

            const fallbackEntry = levels.get(fallbackLevel)?.get(normalizedNpcKey);
            if (fallbackEntry) {
                return fallbackEntry;
            }
        }

        return null;
    }

    static load(dataDir: string): void {
        this.localizedLevels.clear();
        this.loaded = false;

        try {
            const files = fs.readdirSync(dataDir);
            for (const file of files) {
                const match = /^NpcDialogues(?:\.([a-z-]+))?\.json$/i.exec(file);
                if (!match) {
                    continue;
                }

                const locale = this.normalizeLocale(match[1] ?? this.DEFAULT_LOCALE);
                const raw = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) as RawDialogueFile;
                const levels = new Map<string, Map<string, NpcDialogueEntry>>();

                for (const [levelName, npcs] of Object.entries(raw?.levels ?? {})) {
                    const normalizedLevel = this.normalizeLevelName(levelName);
                    const byNpc = new Map<string, NpcDialogueEntry>();

                    for (const [npcKey, entry] of Object.entries(npcs ?? {})) {
                        const normalizedEntry = this.normalizeEntry(entry);
                        if (!normalizedEntry) {
                            continue;
                        }

                        byNpc.set(this.normalizeNpcKey(npcKey), normalizedEntry);
                    }

                    levels.set(normalizedLevel, byNpc);
                }

                this.localizedLevels.set(locale, levels);
            }

            this.loaded = true;
            console.log(`[NpcDialogueLoader] Loaded NPC dialogue locales: ${[...this.localizedLevels.keys()].join(', ') || 'none'}.`);
        } catch (error) {
            console.error(`[NpcDialogueLoader] Failed to load NPC dialogues: ${error}`);
        }
    }

    static isLoaded(): boolean {
        return this.loaded;
    }

    static getLinesForNpc(levelName: string, npcKey: string, character?: Character | null, locale: string = 'en'): string[] {
        const entry = this.resolveEntry(levelName, npcKey, locale);
        if (!entry) {
            return [];
        }

        for (const condition of entry.conditionalLines) {
            if (this.matchesCondition(character, condition)) {
                return normalizeDialogueLinesForClient(condition.lines, locale);
            }
        }

        return normalizeDialogueLinesForClient(entry.defaultLines, locale);
    }
}
