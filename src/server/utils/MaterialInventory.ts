export type MaterialEntry = {
    materialID: number;
    count: number;
};

function normalizeMaterialId(value: unknown): number {
    const materialId = Math.round(Number(value ?? 0));
    return Number.isFinite(materialId) && materialId > 0 ? materialId : 0;
}

function normalizeMaterialCount(value: unknown): number {
    const count = Math.floor(Number(value ?? 1));
    return Number.isFinite(count) && count > 0 ? count : 0;
}

export function normalizeMaterialEntries(rawMaterials: unknown): MaterialEntry[] {
    const materials = Array.isArray(rawMaterials) ? rawMaterials : [];
    const orderedIds: number[] = [];
    const normalized = new Map<number, MaterialEntry>();

    for (const rawMaterial of materials) {
        const material = rawMaterial && typeof rawMaterial === 'object' && !Array.isArray(rawMaterial)
            ? rawMaterial as Record<string, unknown>
            : {};
        const materialId = normalizeMaterialId(material.materialID);
        const count = normalizeMaterialCount(material.count);
        if (materialId <= 0 || count <= 0) {
            continue;
        }

        const existing = normalized.get(materialId);
        if (existing) {
            existing.count += count;
            continue;
        }

        orderedIds.push(materialId);
        normalized.set(materialId, {
            materialID: materialId,
            count
        });
    }

    return orderedIds
        .map((materialId) => normalized.get(materialId))
        .filter((entry): entry is MaterialEntry => Boolean(entry));
}

export function normalizeCharacterMaterials(character: any): MaterialEntry[] {
    const normalized = normalizeMaterialEntries(character?.materials);
    if (character) {
        character.materials = normalized;
    }
    return normalized;
}
