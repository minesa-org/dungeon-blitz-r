import { Client } from '../core/Client';
import { normalizeCharacterKey } from '../core/SocialState';
import { Character } from '../database/Database';

function normalizeCharacterName(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

export function getCraftTownHomeOwnerCharacter(
    character: Character | null | undefined,
    craftTownHostCharacter?: Character | null
): Character | null {
    return craftTownHostCharacter ?? character ?? null;
}

export function getCraftTownHomeInstanceId(
    character: Character | null | undefined,
    craftTownHostCharacter?: Character | null
): string {
    const owner = getCraftTownHomeOwnerCharacter(character, craftTownHostCharacter);
    const ownerKey = normalizeCharacterKey(owner?.name);
    return ownerKey ? `home:${ownerKey}` : '';
}

export function isVisitingAnotherPlayersCraftTown(client: Client): boolean {
    if (client.currentLevel !== 'CraftTown' || !client.character || !client.craftTownHostCharacter) {
        return false;
    }

    const visitorName = normalizeCharacterName(client.character.name);
    const hostName = normalizeCharacterName(client.craftTownHostCharacter.name);
    return Boolean(visitorName && hostName && visitorName !== hostName);
}
