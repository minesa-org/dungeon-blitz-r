type GearEntry = {
    gearID: number;
    tier: number;
    runes: number[];
    colors: number[];
};

function normalizeTier(value: unknown): number {
    const tier = Number(value ?? 0);
    if (!Number.isFinite(tier) || tier <= 0) {
        return 0;
    }
    if (tier >= 2) {
        return 2;
    }
    return 1;
}

function normalizeGearId(value: unknown): number {
    const gearId = Number(value ?? 0);
    return Number.isFinite(gearId) && gearId > 0 ? gearId : 0;
}

export function normalizeGearEntry(raw: unknown): GearEntry {
    const entry = raw && typeof raw === 'object' && !Array.isArray(raw)
        ? raw as Record<string, unknown>
        : {};

    return {
        gearID: normalizeGearId(entry.gearID),
        tier: normalizeTier(entry.tier),
        runes: Array.isArray(entry.runes) ? entry.runes.map((value) => Number(value ?? 0)).slice(0, 3) : [0, 0, 0],
        colors: Array.isArray(entry.colors) ? entry.colors.map((value) => Number(value ?? 0)).slice(0, 2) : [0, 0]
    };
}

function gearModifierScore(entry: GearEntry): number {
    const runeScore = entry.runes.reduce((total, value) => total + (Number(value) !== 0 ? 1 : 0), 0);
    const colorScore = entry.colors.reduce((total, value) => total + (Number(value) !== 0 ? 1 : 0), 0);
    return runeScore + colorScore;
}

export function dedupeInventoryGears(rawInventory: unknown): GearEntry[] {
    const inventory = Array.isArray(rawInventory) ? rawInventory : [];
    const orderedKeys: string[] = [];
    const deduped = new Map<string, GearEntry>();

    for (const rawEntry of inventory) {
        const entry = normalizeGearEntry(rawEntry);
        if (entry.gearID <= 0) {
            continue;
        }

        const key = `${entry.gearID}:${entry.tier}`;
        const existing = deduped.get(key);
        if (!existing) {
            orderedKeys.push(key);
            deduped.set(key, entry);
            continue;
        }

        if (gearModifierScore(entry) > gearModifierScore(existing)) {
            deduped.set(key, entry);
        }
    }

    return orderedKeys
        .map((key) => deduped.get(key))
        .filter((entry): entry is GearEntry => Boolean(entry));
}

export function normalizeCharacterInventoryGears(character: any): GearEntry[] {
    const normalized = dedupeInventoryGears(character?.inventoryGears);
    if (character) {
        character.inventoryGears = normalized;
    }
    return normalized;
}

export function upsertInventoryGear(
    character: any,
    gearId: unknown,
    tier: unknown,
    runes: unknown[] = [0, 0, 0],
    colors: unknown[] = [0, 0]
): { inserted: boolean; inventory: GearEntry[] } {
    const inventory = normalizeCharacterInventoryGears(character);
    const normalizedGearId = normalizeGearId(gearId);
    const normalizedTier = normalizeTier(tier);
    if (normalizedGearId <= 0) {
        return { inserted: false, inventory };
    }

    const duplicate = inventory.some((entry) => entry.gearID === normalizedGearId && entry.tier === normalizedTier);
    if (!duplicate) {
        inventory.push({
            gearID: normalizedGearId,
            tier: normalizedTier,
            runes: Array.isArray(runes) ? runes.map((value) => Number(value ?? 0)).slice(0, 3) : [0, 0, 0],
            colors: Array.isArray(colors) ? colors.map((value) => Number(value ?? 0)).slice(0, 2) : [0, 0]
        });
    }

    if (character) {
        character.inventoryGears = inventory;
    }

    return { inserted: !duplicate, inventory };
}
