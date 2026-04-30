const ROYAL_SIGIL_STORE_UNLOCKED = 1;
const ROYAL_SIGIL_STORE_SEEN = 2;
const TREASURE_TROVE_UNLOCK_COUNT = 10;

function getAlertState(character: any): number {
    const current = Number(character?.alertState ?? 0);
    return Number.isFinite(current) ? Math.max(0, Math.min(15, Math.floor(current))) : 0;
}

function hasUnlockedTreasureTrove(character: any): boolean {
    for (const rawLockbox of Array.isArray(character?.lockboxes) ? character.lockboxes : []) {
        const count = Number(rawLockbox?.count ?? 0);
        if (Number.isFinite(count) && count >= TREASURE_TROVE_UNLOCK_COUNT) {
            return true;
        }
    }

    return false;
}

export function markAlertState(character: any, alertMask: number): boolean {
    if (!character || typeof character !== 'object') {
        return false;
    }

    const normalizedMask = Math.max(0, Math.min(15, Math.floor(Number(alertMask ?? 0))));
    if (normalizedMask <= 0) {
        return false;
    }

    const current = getAlertState(character);
    const next = current | normalizedMask;
    character.alertState = next;
    return next !== current;
}

export function ensureSigilStoreAlertState(character: any): boolean {
    if (!character || typeof character !== 'object') {
        return false;
    }

    let requiredMask = 0;
    if (hasUnlockedTreasureTrove(character)) {
        requiredMask |= ROYAL_SIGIL_STORE_UNLOCKED;
    }

    if (Number(character.SilverSigils ?? 0) > 0) {
        requiredMask |= ROYAL_SIGIL_STORE_UNLOCKED | ROYAL_SIGIL_STORE_SEEN;
    }

    return markAlertState(character, requiredMask);
}
