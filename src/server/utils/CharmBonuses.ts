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

            const charm = GameData.CHARMS.find((entry) => Number(entry?.CharmID ?? 0) === runeId);
            if (!charm) {
                continue;
            }

            bonuses.goldFind += Number(charm.GoldDrop ?? 0) || 0;
            bonuses.itemFind += Number(charm.ItemDrop ?? 0) || 0;
            bonuses.craftFind += Number(charm.CraftDrop ?? 0) || 0;
            bonuses.hitPointBoost += Number(charm.HitPointBoost ?? 0) || 0;
            bonuses.powerBonus += Number(charm.PowerBonus ?? 0) || 0;
            bonuses.meleeBonus += Number(charm.MeleeBonus ?? 0) || 0;
            bonuses.magicBonus += Number(charm.MagicBonus ?? 0) || 0;
            bonuses.armorBonus += Number(charm.ArmorBonus ?? 0) || 0;
        }
    }

    return bonuses;
}
