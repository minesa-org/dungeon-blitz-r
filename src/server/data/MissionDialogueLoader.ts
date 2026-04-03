import fs from 'fs';
import path from 'path';
import { MissionDef, MissionLoader } from './MissionLoader';
import { normalizeDialogueTextForClient } from './DialogueTextNormalizer';

type MissionDialogueField = 'OfferText' | 'ActiveText' | 'ReturnText' | 'PraiseText';

type RawMissionDialogueEntry = Partial<Record<MissionDialogueField, string>>;
type RawMissionDialogueFile = {
    missions?: Record<string, RawMissionDialogueEntry>;
};

export class MissionDialogueLoader {
    private static readonly DEFAULT_LOCALE = 'en';
    private static readonly DIALOGUE_FIELD_BY_ID: Record<number, MissionDialogueField | undefined> = {
        2: 'OfferText',
        3: 'ActiveText',
        4: 'ReturnText',
        5: 'PraiseText'
    };
    private static readonly localizedDialogs: Map<string, Map<number, RawMissionDialogueEntry>> = new Map();
    private static loaded = false;

    private static normalizeLocale(locale: string): string {
        const normalized = String(locale ?? '').trim().toLowerCase();
        return normalized || this.DEFAULT_LOCALE;
    }

    private static sanitizeText(value: unknown): string {
        return String(value ?? '').trim();
    }

    private static normalizeEntry(entry: RawMissionDialogueEntry | null | undefined): RawMissionDialogueEntry | null {
        if (!entry || typeof entry !== 'object') {
            return null;
        }

        const normalized: RawMissionDialogueEntry = {};
        const fields: MissionDialogueField[] = ['OfferText', 'ActiveText', 'ReturnText', 'PraiseText'];
        for (const field of fields) {
            const value = this.sanitizeText(entry[field]);
            if (value) {
                normalized[field] = value;
            }
        }

        return Object.keys(normalized).length > 0 ? normalized : null;
    }

    static load(dataDir: string): void {
        this.localizedDialogs.clear();
        this.loaded = false;

        try {
            const files = fs.readdirSync(dataDir);
            for (const file of files) {
                const match = /^MissionDialogues\.([a-z-]+)\.json$/i.exec(file);
                if (!match) {
                    continue;
                }

                const locale = this.normalizeLocale(match[1]);
                const fullPath = path.join(dataDir, file);
                const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as RawMissionDialogueFile;
                const missionEntries = new Map<number, RawMissionDialogueEntry>();

                for (const [missionIdRaw, entry] of Object.entries(raw?.missions ?? {})) {
                    const missionId = Number(missionIdRaw);
                    if (!Number.isFinite(missionId) || missionId <= 0) {
                        continue;
                    }

                    const normalizedEntry = this.normalizeEntry(entry);
                    if (!normalizedEntry) {
                        continue;
                    }

                    missionEntries.set(missionId, normalizedEntry);
                }

                this.localizedDialogs.set(locale, missionEntries);
            }

            this.loaded = true;
            console.log(`[MissionDialogueLoader] Loaded mission dialogue locales: ${[...this.localizedDialogs.keys()].join(', ') || 'none'}.`);
        } catch (error) {
            console.error(`[MissionDialogueLoader] Failed to load mission dialogue overrides: ${error}`);
        }
    }

    static isLoaded(): boolean {
        return this.loaded;
    }

    static getDialogueText(missionId: number, dialogueId: number, locale: string): string {
        const field = this.DIALOGUE_FIELD_BY_ID[dialogueId];
        const missionDef = MissionLoader.getMissionDef(missionId);
        if (!field || !missionDef) {
            return '';
        }

        const normalizedLocale = this.normalizeLocale(locale);
        if (normalizedLocale !== this.DEFAULT_LOCALE) {
            const localized = this.localizedDialogs.get(normalizedLocale)?.get(missionId)?.[field];
            if (localized) {
                return normalizeDialogueTextForClient(localized, normalizedLocale);
            }
        }

        return normalizeDialogueTextForClient(
            this.sanitizeText((missionDef as MissionDef & Record<MissionDialogueField, string | undefined>)[field]),
            normalizedLocale
        );
    }
}
