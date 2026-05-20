import type { Client } from './Client';
import { BitReader } from '../network/protocol/bitReader';

function parseBooleanEnv(name: string, fallback: boolean): boolean {
    const raw = process.env[name];
    if (raw === undefined) {
        return fallback;
    }

    switch (String(raw).trim().toLowerCase()) {
        case '1':
        case 'true':
        case 'yes':
        case 'on':
            return true;
        case '0':
        case 'false':
        case 'no':
        case 'off':
            return false;
        default:
            return fallback;
    }
}

function limitHex(data: Buffer, maxBytes: number): string {
    if (data.length <= maxBytes) {
        return data.toString('hex');
    }

    return `${data.subarray(0, maxBytes).toString('hex')}...(${data.length} bytes)`;
}

type PacketEntityRef = {
    role: string;
    id: number;
};

export const DebugConfig = {
    enabled: parseBooleanEnv('DEBUG_ENABLED', false),
    packets: parseBooleanEnv('DEBUG_PACKETS', parseBooleanEnv('DEBUG_ENABLED', false)),
    progress: parseBooleanEnv('DEBUG_PROGRESS', parseBooleanEnv('DEBUG_ENABLED', false)),
    packetPayloads: parseBooleanEnv('DEBUG_PACKET_PAYLOADS', false),
    unhandledPackets: parseBooleanEnv('DEBUG_UNHANDLED_PACKETS', parseBooleanEnv('DEBUG_ENABLED', false)),
    router: parseBooleanEnv('DEBUG_ROUTER', parseBooleanEnv('DEBUG_ENABLED', false)),
    payloadPreviewBytes: Math.max(1, Number(process.env.DEBUG_PAYLOAD_PREVIEW_BYTES ?? 64) || 64)
};

export class DebugLogger {
    private static asRecord(value: unknown): Record<string, unknown> {
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value as Record<string, unknown>
            : {};
    }

    private static asArray(value: unknown): unknown[] {
        return Array.isArray(value) ? value : [];
    }

    private static normalizeMissionStates(value: unknown): Record<string, number> {
        const missions = DebugLogger.asRecord(value);
        const missionIds = ['1', '2', '3', '4', '5', '6'];
        const summary: Record<string, number> = {};

        for (const missionId of missionIds) {
            const entry = DebugLogger.asRecord(missions[missionId]);
            const state = Number(entry.state ?? 0);
            if (state > 0) {
                summary[missionId] = state;
            }
        }

        return summary;
    }

    private static normalizeBuildingRanks(value: unknown): Record<string, number> {
        const statsByBuilding = DebugLogger.asRecord(value);
        const buildingIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'];
        const summary: Record<string, number> = {};

        for (const buildingId of buildingIds) {
            const rank = Number(statsByBuilding[buildingId] ?? 0);
            if (rank > 0) {
                summary[buildingId] = rank;
            }
        }

        return summary;
    }

    private static normalizeLearnedAbilities(value: unknown): Array<{ abilityID: number; rank: number }> {
        const learned = DebugLogger.asArray(value);
        return learned
            .map((entry) => {
                const ability = DebugLogger.asRecord(entry);
                return {
                    abilityID: Number(ability.abilityID ?? 0),
                    rank: Number(ability.rank ?? 0)
                };
            })
            .filter((entry) => entry.abilityID > 0 && entry.rank > 0)
            .sort((left, right) => left.abilityID - right.abilityID);
    }

    private static normalizeActiveAbilities(value: unknown): number[] {
        return DebugLogger.asArray(value)
            .map((entry) => Number(entry ?? 0))
            .filter((entry) => entry > 0);
    }

    private static snapshotCharacterProgress(character: Record<string, unknown> | null | undefined): Record<string, unknown> {
        const safeCharacter = DebugLogger.asRecord(character);
        const currentLevel = DebugLogger.asRecord(safeCharacter.CurrentLevel);
        const previousLevel = DebugLogger.asRecord(safeCharacter.PreviousLevel);
        const magicForge = DebugLogger.asRecord(safeCharacter.magicForge);
        const skillResearch = DebugLogger.asRecord(safeCharacter.SkillResearch);
        const buildingUpgrade = DebugLogger.asRecord(safeCharacter.buildingUpgrade);

        return {
            name: String(safeCharacter.name ?? ''),
            class: String(safeCharacter.class ?? ''),
            currentLevel: String(currentLevel.name ?? ''),
            previousLevel: String(previousLevel.name ?? ''),
            questTrackerState: Number(safeCharacter.questTrackerState ?? 0),
            missions: DebugLogger.normalizeMissionStates(safeCharacter.missions),
            learnedAbilities: DebugLogger.normalizeLearnedAbilities(safeCharacter.learnedAbilities),
            activeAbilities: DebugLogger.normalizeActiveAbilities(safeCharacter.activeAbilities),
            buildingRanks: DebugLogger.normalizeBuildingRanks(magicForge.stats_by_building),
            buildingUpgrade: {
                buildingID: Number(buildingUpgrade.buildingID ?? 0),
                rank: Number(buildingUpgrade.rank ?? 0),
                ReadyTime: Number(buildingUpgrade.ReadyTime ?? 0)
            },
            skillResearch: {
                abilityID: Number(skillResearch.abilityID ?? 0),
                rank: Number(skillResearch.rank ?? 0),
                ReadyTime: Number(skillResearch.ReadyTime ?? 0)
            }
        };
    }

    private static formatClient(client: Client | null | undefined): string {
        if (!client) {
            return 'user=- token=0 char=- level=- ent=0';
        }

        const pendingLevel = String(client.pendingDebugLevel || '').trim();
        const currentLevel = String(client.currentLevel || '').trim();
        const characterLevel = String(client.character?.CurrentLevel?.name ?? '').trim();
        const debugLevel =
            pendingLevel ||
            (client.playerSpawned ? currentLevel : characterLevel) ||
            currentLevel ||
            '-';

        return [
            `user=${client.userId ?? '-'}`,
            `token=${client.token ?? 0}`,
            `char=${client.character?.name ?? '-'}`,
            `level=${debugLevel}`,
            `ent=${client.clientEntID || 0}`
        ].join(' ');
    }

    private static formatPayload(data: Buffer): string {
        const hex = DebugConfig.packetPayloads
            ? data.toString('hex')
            : limitHex(data, DebugConfig.payloadPreviewBytes);
        return `payload=${hex}`;
    }

    private static getJadeCityBossDisplayName(levelName: string, entityName: string): string {
        if (String(levelName ?? '').trim() !== 'JC_Mission2') {
            return '';
        }

        switch (String(entityName ?? '').trim()) {
            case 'GreaterBoneGolem':
                return 'Seelie Ravager';
            case 'GreaterBoneGolem2':
                return 'Mortis Golem';
            default:
                return '';
        }
    }

    private static getEntityDisplayName(client: Client, entity: any): string {
        const entityName = String(entity?.name ?? entity?.EntName ?? entity?.entName ?? '').trim();
        const explicitDisplayName = String(entity?.displayName ?? entity?.display_name ?? '').trim();
        const levelName = String(client.currentLevel || client.character?.CurrentLevel?.name || '').trim();
        return explicitDisplayName || DebugLogger.getJadeCityBossDisplayName(levelName, entityName) || entityName || '(unknown)';
    }

    private static formatEntityRef(client: Client, ref: PacketEntityRef): string | null {
        if (!Number.isFinite(ref.id) || ref.id <= 0) {
            return null;
        }

        const entity = client.entities?.get(ref.id);
        if (!entity) {
            return `${ref.role}:unknown#${ref.id}`;
        }

        const displayName = DebugLogger.getEntityDisplayName(client, entity);
        const rawName = String(entity?.name ?? entity?.EntName ?? entity?.entName ?? '').trim();
        const details: string[] = [
            `${ref.role}:${displayName}#${ref.id}`
        ];

        if (rawName && rawName !== displayName) {
            details.push(`type=${rawName}`);
        }

        const team = Number(entity?.team ?? NaN);
        if (Number.isFinite(team)) {
            details.push(`team=${Math.round(team)}`);
        }

        const roomId = Number(entity?.roomId ?? entity?.room ?? NaN);
        if (Number.isFinite(roomId)) {
            details.push(`room=${Math.round(roomId)}`);
        }

        const hp = Number(entity?.hp ?? NaN);
        const maxHp = Number(entity?.maxHp ?? NaN);
        const healthDelta = Number(entity?.healthDelta ?? entity?.health_delta ?? NaN);
        if (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0) {
            details.push(`hp=${Math.round(hp)}/${Math.round(maxHp)}`);
        } else if (Number.isFinite(healthDelta) && healthDelta !== 0) {
            details.push(`hpDelta=${Math.round(healthDelta)}`);
        }

        return details.join(',');
    }

    private static readMethod4(data: Buffer): number | null {
        try {
            return new BitReader(data).readMethod4();
        } catch {
            return null;
        }
    }

    private static readMethod9Refs(data: Buffer, roles: string[]): PacketEntityRef[] {
        const refs: PacketEntityRef[] = [];
        const br = new BitReader(data);
        try {
            for (const role of roles) {
                refs.push({
                    role,
                    id: br.readMethod9()
                });
            }
        } catch {
            return refs;
        }
        return refs;
    }

    private static parsePacketEntityRefs(packetId: number, data: Buffer): PacketEntityRef[] {
        switch (packetId) {
            case 0x07:
            case 0x0E: {
                const id = DebugLogger.readMethod4(data);
                return id ? [{ role: 'entity', id }] : [];
            }
            case 0x09: {
                const id = DebugLogger.readMethod4(data);
                return id ? [{ role: 'source', id }] : [];
            }
            case 0x0A:
                return DebugLogger.readMethod9Refs(data, ['target', 'source']);
            case 0x0B:
            case 0x0C:
            case 0x0D:
                return DebugLogger.readMethod9Refs(data, ['entity']);
            default:
                return [];
        }
    }

    private static formatPacketEntityRefs(client: Client, packetId: number, data: Buffer): string {
        const refs = DebugLogger.parsePacketEntityRefs(packetId, data);
        const labels = refs
            .map((ref) => DebugLogger.formatEntityRef(client, ref))
            .filter((value): value is string => Boolean(value));

        if (!labels.length) {
            return '';
        }

        return ` refs=[${labels.join(' ')}]`;
    }

    static previewBuffer(data: Buffer): string {
        return DebugConfig.packetPayloads
            ? data.toString('hex')
            : limitHex(data, DebugConfig.payloadPreviewBytes);
    }

    static log(scope: string, message: string): void {
        if (!DebugConfig.enabled) {
            return;
        }

        console.log(`[Debug][${scope}] ${message}`);
    }

    static logPacket(direction: 'IN' | 'OUT', client: Client, packetId: number, data: Buffer): void {
        if (!DebugConfig.packets) {
            return;
        }

        const details = [
            `0x${packetId.toString(16)}`,
            `len=${data.length}`,
            DebugLogger.formatClient(client),
            DebugLogger.formatPayload(data) + DebugLogger.formatPacketEntityRefs(client, packetId, data)
        ].join(' ');
        console.log(`[Debug][Packet ${direction}] ${details}`);
    }

    static logRouter(client: Client, packetId: number, handlerName: string, data: Buffer): void {
        if (!DebugConfig.router) {
            return;
        }

        console.log(
            `[Debug][Router] handled=0x${packetId.toString(16)} handler=${handlerName || 'anonymous'} len=${data.length} ${DebugLogger.formatClient(client)}`
        );
    }

    static logUnhandledPacket(client: Client, packetId: number, data: Buffer): void {
        if (!DebugConfig.unhandledPackets) {
            return;
        }

        console.warn(
            `[Debug][Unhandled] 0x${packetId.toString(16)} len=${data.length} ${DebugLogger.formatClient(client)} ${DebugLogger.formatPayload(data)}`
        );
    }

    static logProgress(
        scope: string,
        client?: Client | null,
        character?: Record<string, unknown> | null,
        extra?: Record<string, unknown>
    ): void {
        if (!DebugConfig.progress) {
            return;
        }

        const snapshot = DebugLogger.snapshotCharacterProgress(
            character ?? (client?.character as Record<string, unknown> | null | undefined)
        );
        const details = {
            ...(extra ?? {}),
            snapshot
        };

        console.log(
            `[Debug][Progress][${scope}] ${DebugLogger.formatClient(client)} ${JSON.stringify(details)}`
        );
    }

    static logStartup(): void {
        if (!DebugConfig.enabled) {
            return;
        }

        console.log(
            `[Debug] enabled packets=${DebugConfig.packets} progress=${DebugConfig.progress} router=${DebugConfig.router} unhandled=${DebugConfig.unhandledPackets} payloads=${DebugConfig.packetPayloads}`
        );
    }
}
