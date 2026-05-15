import fs from 'fs';
import path from 'path';
import { normalizeDialogueTextForClient } from './DialogueTextNormalizer';
import { localizeUnknownTurkishText } from './TurkishTextLocalizer';

type RawDialogueTranslationFile = {
    translations?: Record<string, string>;
};

type DialogueTranslationOptions = {
    fallbackToGeneric?: boolean;
};

export class DialogueTranslationLoader {
    private static readonly DEFAULT_LOCALE = 'en';
    private static readonly translationsByLocale: Map<string, Map<string, string>> = new Map();
    private static loaded = false;
    private static readonly HELP_FALLBACKS = [
        'Yardim edin!',
        'Beni koruyun!',
        'Buraya yardim gerek!'
    ];
    private static readonly WARNING_FALLBACKS = [
        'Dikkat!',
        'Tetikte olun!',
        'Tehlike yakinda!'
    ];
    private static readonly FIRE_FALLBACKS = [
        'Her sey yanacak!',
        'Kule doneceksin!',
        'Alevler seni yutacak!'
    ];
    private static readonly KILL_FALLBACKS = [
        'Seni yok edecegim!',
        'Burada oleceksin!',
        'Seni parcalayacagim!',
        'Sonun geldi!',
        'Kanini dokecegim!',
        'Seni mezara gonderecegim!'
    ];
    private static readonly ATTACK_FALLBACKS = [
        'Saldiriya gecin!',
        'Ustune gidin!',
        'Onu durdurun!',
        'Hucum edin!',
        'Etrafini sarin!',
        'Savasa hazirlanin!'
    ];
    private static readonly INTRUDER_FALLBACKS = [
        'Davetsiz misafir!',
        'Yabanci burada!',
        'Hirsizi yakalayin!',
        'Buraya ait degilsin!',
        'Ihlalciyi durdurun!'
    ];
    private static readonly GENERIC_ENEMY_FALLBACKS = [
        'Geri cekil!',
        'Buradan gecemezsin!',
        'Sana izin vermeyecegiz!',
        'Bunu odetecegiz!',
        'Kaderin burada bitecek!',
        'Gucumuzu goreceksin!',
        'Karsimiza cikmamaliydin!',
        'Burasi bizim bolgemiz!'
    ];

    private static normalizeLocale(locale: string): string {
        const normalized = String(locale ?? '').trim().toLowerCase();
        return normalized || this.DEFAULT_LOCALE;
    }

    private static normalizeKey(value: string): string {
        return String(value ?? '').trim().replace(/\s+/g, ' ');
    }

    private static stripClientDirectives(value: string): string {
        return this.normalizeKey(
            String(value ?? '')
                .replace(/^[@:]+/, '')
                .replace(/^(?:\s*<[^>]+>\s*)+/, '')
                .replace(/^\^t\s*/, '')
        );
    }

    private static getTranslation(translations: Map<string, string>, text: string): string {
        const key = this.normalizeKey(text);
        const strippedKey = this.stripClientDirectives(key);
        return translations.get(key) ?? translations.get(strippedKey) ?? '';
    }

    private static translateCompositeText(translations: Map<string, string>, text: string): string {
        const parts = String(text ?? '').split(/(=@|=)/);
        if (parts.length <= 1) {
            return '';
        }

        let changed = false;
        const translated = parts.map((part) => {
            if (part === '=' || part === '=@') {
                return part;
            }

            const replacement = this.getTranslation(translations, part);
            if (!replacement) {
                return part;
            }

            changed = true;
            return replacement;
        }).join('');

        return changed ? translated : '';
    }

    private static looksLikeEnglishText(text: string): boolean {
        return /[A-Za-z]{2,}/.test(text);
    }

    private static pickFallback(text: string, choices: string[]): string {
        if (!choices.length) {
            return text;
        }

        let hash = 0;
        for (const char of String(text ?? '')) {
            hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
        }

        return choices[Math.abs(hash) % choices.length];
    }

    private static translateUnknownRoomThought(text: string): string {
        const clean = this.stripClientDirectives(text);
        if (!this.looksLikeEnglishText(clean)) {
            return text;
        }

        if (/^nothing\.?$/i.test(clean)) {
            return 'Hicbir sey.';
        }
        if (/\b(help|save|protect)\b/i.test(clean)) {
            return this.pickFallback(clean, this.HELP_FALLBACKS);
        }
        if (/\b(warning|beware)\b/i.test(clean)) {
            return this.pickFallback(clean, this.WARNING_FALLBACKS);
        }
        if (/\b(Meylour)\b/i.test(clean)) {
            return 'Meylour icin!';
        }
        if (/\b(Nephit)\b/i.test(clean)) {
            return 'Nephit icin!';
        }
        if (/\b(Emperor)\b/i.test(clean)) {
            return 'Imparator icin!';
        }
        if (/\b(burn|fire|ashes|ash)\b/i.test(clean)) {
            return this.pickFallback(clean, this.FIRE_FALLBACKS);
        }
        if (/\b(die|kill|slay|destroy|annihilation|curse|blood)\b/i.test(clean)) {
            return this.pickFallback(clean, this.KILL_FALLBACKS);
        }
        if (/\b(come|rise|charge|attack|swarm|defend|guard|to me)\b/i.test(clean)) {
            return this.pickFallback(clean, this.ATTACK_FALLBACKS);
        }
        if (/\b(human|trespasser|thief|thieves|usurper)\b/i.test(clean)) {
            return this.pickFallback(clean, this.INTRUDER_FALLBACKS);
        }

        return this.pickFallback(clean, this.GENERIC_ENEMY_FALLBACKS);
    }

    static load(dataDir: string): void {
        this.translationsByLocale.clear();
        this.loaded = false;

        try {
            const files = fs.readdirSync(dataDir);
            for (const file of files) {
                const match = /^DialogueTranslations\.([a-z-]+)\.json$/i.exec(file);
                if (!match) {
                    continue;
                }

                const locale = this.normalizeLocale(match[1]);
                const raw = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')) as RawDialogueTranslationFile;
                const translations = new Map<string, string>();

                for (const [source, translated] of Object.entries(raw?.translations ?? {})) {
                    const key = this.normalizeKey(source);
                    const value = String(translated ?? '').trim();
                    if (!key || !value) {
                        continue;
                    }

                    translations.set(key, value);
                }

                this.translationsByLocale.set(locale, translations);
            }

            this.loaded = true;
            console.log(`[DialogueTranslationLoader] Loaded dialogue translation locales: ${[...this.translationsByLocale.keys()].join(', ') || 'none'}.`);
        } catch (error) {
            console.error(`[DialogueTranslationLoader] Failed to load dialogue translations: ${error}`);
        }
    }

    static isLoaded(): boolean {
        return this.loaded;
    }

    static translateText(text: string, locale: string, options: DialogueTranslationOptions = {}): string {
        const normalizedLocale = this.normalizeLocale(locale);
        if (normalizedLocale === this.DEFAULT_LOCALE) {
            return text;
        }

        const translations = this.translationsByLocale.get(normalizedLocale);
        if (!translations) {
            return text;
        }

        const translated = this.getTranslation(translations, text) || this.translateCompositeText(translations, text);
        if (!translated) {
            if (options.fallbackToGeneric) {
                return normalizeDialogueTextForClient(
                    this.translateUnknownRoomThought(text),
                    normalizedLocale
                );
            }
            if (normalizedLocale === 'tr' && this.looksLikeEnglishText(this.stripClientDirectives(text))) {
                return localizeUnknownTurkishText(text);
            }
            return text;
        }

        return normalizeDialogueTextForClient(translated, normalizedLocale);
    }
}
