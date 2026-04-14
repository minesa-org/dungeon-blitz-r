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
