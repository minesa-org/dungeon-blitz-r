import type { Character } from '../database/Database';
import { GameData } from './GameData';
import { GlobalState } from './GlobalState';
import type { Client } from './Client';
import { getPartyIdForClient } from './PartySync';

export function clampRuntimeLevel(value: unknown, fallbackLevel: number = 1): number {
    const fallback = Math.max(1, Math.min(50, Math.round(Number(fallbackLevel) || 1)));
    const level = Math.round(Number(value));
    if (!Number.isFinite(level) || level <= 0) {
        return fallback;
    }

    return Math.max(1, Math.min(50, level));
}

export function getCharacterRuntimeLevel(
    character: Partial<Pick<Character, 'level' | 'xp'>> | null | undefined,
    fallbackLevel: number = 1
): number {
    const xpLevel = GameData.getPlayerLevelFromXp(Math.max(0, Number(character?.xp ?? 0)));
    const characterLevel = Math.max(1, Number(character?.level ?? 0));
    const resolvedLevel = xpLevel > 1 ? xpLevel : characterLevel;
    return clampRuntimeLevel(resolvedLevel, fallbackLevel);
}

export function getPartyRuntimeLevelForClient(
    client: Pick<Client, 'character'> | null | undefined,
    fallbackCharacter: Partial<Pick<Character, 'level' | 'xp'>> | null | undefined = client?.character,
    fallbackLevel: number = 1
): number {
    const ownRuntimeLevel = getCharacterRuntimeLevel(fallbackCharacter, fallbackLevel);
    const partyId = getPartyIdForClient(client);
    if (partyId <= 0) {
        return ownRuntimeLevel;
    }

    let maxLevel = ownRuntimeLevel;
    for (const session of GlobalState.sessionsByToken.values()) {
        if (!GlobalState.isSessionOpen(session) || getPartyIdForClient(session) !== partyId) {
            continue;
        }

        maxLevel = Math.max(maxLevel, getCharacterRuntimeLevel(session.character, ownRuntimeLevel));
    }

    return clampRuntimeLevel(maxLevel, ownRuntimeLevel);
}
