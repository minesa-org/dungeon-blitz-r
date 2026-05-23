export function normalizeGender(value: unknown): string {
    const raw = String(value ?? '').trim();
    const lowered = raw.toLowerCase();

    if (lowered === 'male') {
        return 'Male';
    }

    if (lowered === 'female') {
        return 'Female';
    }

    return raw;
}

/**
 * Resolve the gender of a character at creation time.  The SWF patch makes the
 * client send "Male" or "Female" in the character-creation packet, but for any
 * legacy characters (or if the client somehow still sends an empty string) we
 * fall back to inferring gender from the visual asset naming convention:
 *   - Assets prefixed with "Female", "FDo", "FMouth", or "FFace" → Female
 *   - Everything else → Male (the game's default)
 */
export function resolveCharacterGender(
    gender: unknown,
    headSet: string,
    hairSet: string,
    mouthSet: string,
    faceSet: string
): string {
    const normalized = normalizeGender(gender);
    if (normalized === 'Male' || normalized === 'Female') {
        return normalized;
    }

    const parts = [headSet, hairSet, mouthSet, faceSet];
    for (const part of parts) {
        if (/female/i.test(part)) return 'Female';
    }
    for (const part of parts) {
        if (/^FDo/i.test(part) || /^FMouth/i.test(part) || /^FFace/i.test(part)) return 'Female';
    }

    return 'Male';
}
