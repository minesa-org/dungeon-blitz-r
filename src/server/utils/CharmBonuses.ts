import { GameData } from '../core/GameData';

export interface CharmBonuses {
    goldFind: number;
    itemFind: number;
    craftFind: number;
    hitPointBoost: number;
    powerBonus: number;
    meleeBonus: number;
    magicBonus: number;
    armorBonus: number;
}

const CHARM_PRIMARY_MASK = 0x1ff;
const CHARM_SECONDARY_SHIFT = 9;
const CHARM_SECONDARY_MASK = 0x1f;
const CHARM_TIER_SHIFT = 14;
const CHARM_TIER_MASK = 0x3;
const SECONDARY_CHARM_TYPES = [
    '',
    'Trog',
    'Infernal',
    'Undead',
    'Mythic',
    'Draconic',
    'Sylvan',
    'Melee',
    'Magic',
    'Armor'
] as const;

function getCharmById(charmId: number): any | null {
    return GameData.CHARMS.find((entry) => Number(entry?.CharmID ?? 0) === charmId) ?? null;
}

function getCharmByName(charmName: string): any | null {
    return GameData.CHARMS.find((entry) => String(entry?.CharmName ?? '') === charmName) ?? null;
}

function addCharmStats(bonuses: CharmBonuses, charm: any, multiplier: number = 1): void {
    bonuses.goldFind += (Number(charm?.GoldDrop ?? 0) || 0) * multiplier;
    bonuses.itemFind += (Number(charm?.ItemDrop ?? 0) || 0) * multiplier;
    bonuses.craftFind += (Number(charm?.CraftDrop ?? 0) || 0) * multiplier;
    bonuses.hitPointBoost += (Number(charm?.HitPointBoost ?? 0) || 0) * multiplier;
    bonuses.powerBonus += (Number(charm?.PowerBonus ?? 0) || 0) * multiplier;
    bonuses.meleeBonus += (Number(charm?.MeleeBonus ?? 0) || 0) * multiplier;
    bonuses.magicBonus += (Number(charm?.MagicBonus ?? 0) || 0) * multiplier;
    bonuses.armorBonus += (Number(charm?.ArmorBonus ?? 0) || 0) * multiplier;
}

function getSecondaryCharm(primaryCharm: any, secondaryType: number): any | null {
    const secondaryPrefix = SECONDARY_CHARM_TYPES[secondaryType] ?? '';
    if (!secondaryPrefix) {
        return null;
    }

    const primaryName = String(primaryCharm?.CharmName ?? '');
    const suffix = primaryName.match(/(\d+)$/)?.[1] ?? '';
    if (!suffix) {
        return null;
    }

    return getCharmByName(`${secondaryPrefix}${suffix}`);
}

export function getEquippedCharmBonuses(character: any): CharmBonuses {
    const bonuses: CharmBonuses = {
        goldFind: 0,
        itemFind: 0,
        craftFind: 0,
        hitPointBoost: 0,
        powerBonus: 0,
        meleeBonus: 0,
        magicBonus: 0,
        armorBonus: 0
    };

    for (const rawGear of Array.isArray(character?.equippedGears) ? character.equippedGears : []) {
        const runes = Array.isArray(rawGear?.runes) ? rawGear.runes : [];
        for (const rawRuneId of runes) {
            const runeId = Number(rawRuneId ?? 0);
            if (runeId <= 0) {
                continue;
            }

            const primaryId = runeId & CHARM_PRIMARY_MASK;
            const secondaryType = (runeId >> CHARM_SECONDARY_SHIFT) & CHARM_SECONDARY_MASK;
            const secondaryTier = (runeId >> CHARM_TIER_SHIFT) & CHARM_TIER_MASK;
            const charm = getCharmById(primaryId);
            if (!charm) {
                continue;
            }

            addCharmStats(bonuses, charm);

            if (secondaryType <= 0 || secondaryTier <= 0) {
                continue;
            }

            const secondaryCharm = getSecondaryCharm(charm, secondaryType);
            if (!secondaryCharm) {
                continue;
            }

            addCharmStats(bonuses, secondaryCharm, secondaryTier === 1 ? 0.5 : 1);
        }
    }

    return bonuses;
}
