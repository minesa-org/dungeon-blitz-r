
import { Client, ClientCombatEventSnapshot } from '../core/Client';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../core/config';
import { EntityState, EntityTeam } from '../core/Entity';
import { GameData } from '../core/GameData';
import { GlobalState } from '../core/GlobalState';
import { getClientLevelScope } from '../core/LevelScope';
import { sharesRoomIds } from '../core/PartySync';

interface CrashDebugEntType {
    name: string;
    parent: string;
    values: Record<string, string>;
    gfx: Record<string, string>;
}

interface CrashDebugPower {
    name: string;
    id: number;
    sourceFile: string;
    castAnim: string;
    targetMethod: string;
    gfx: string[];
}

interface CrashDebugData {
    entTypes: Map<string, CrashDebugEntType>;
    powersById: Map<number, CrashDebugPower>;
    powersByName: Map<string, CrashDebugPower>;
}

export class SystemHandler {
    private static crashDebugData: CrashDebugData | null | undefined;

    // 0x7C: Client Crash Report
    // Python: _, length = struct.unpack_from(">HH", data, 0); payload = data[4:4 + length]
    static handleClientCrashReport(client: Client, data: Buffer): void {
        try {
            // data is payload only if from router? 
            // Router passes payload.
            // But python logic unpacks length from header? 
            // "Client_Crash_Reports(session, data)" where data includes header in Python?
            // "_, length = struct.unpack_from(">HH", data, 0)" -> This reads the header length.
            
            // In our TS Router:
            // "const payload = this.buffer.subarray(4, total);" is passed.
            // So 'data' here is just the payload string bytes?
            
            const message = SystemHandler.decodeCrashMessage(data);
            const context = SystemHandler.buildCrashContext(client);
            console.error(`[Client System Error] User ${client.userId}: ${message}${context ? `\n${context}` : ''}`);
            SystemHandler.appendCrashLog(client, message, context);
        } catch (err) {
            console.error(`[SystemHandler] Error parsing crash report`, err);
            console.error(data.toString('hex'));
        }
    }

    private static appendCrashLog(client: Client, message: string, context: string = ''): void {
        try {
            const runtimeDir = path.resolve(Config.DATA_DIR, 'data', 'runtime');
            fs.mkdirSync(runtimeDir, { recursive: true });
            const contextBlock = context ? `\n${context}` : '';
            fs.appendFileSync(
                path.join(runtimeDir, 'client-crash.log'),
                `[${new Date().toISOString()}] User ${client.userId}: ${message}${contextBlock}\n\n`
            );
        } catch {
            // Keep crash-report handling non-fatal.
        }
    }

    private static decodeCrashMessage(data: Buffer): string {
        if (data.length >= 2) {
            const stringLength = data.readUInt16BE(0);
            if (stringLength > 0 && stringLength <= data.length - 2) {
                return data.subarray(2, 2 + stringLength).toString('utf-8');
            }
        }

        if (data.length >= 4) {
            const payloadLength = data.readUInt16BE(2);
            if (payloadLength > 0 && payloadLength <= data.length - 4) {
                return data.subarray(4, 4 + payloadLength).toString('utf-8');
            }
        }

        return data.toString('utf-8');
    }

    static buildCrashContext(client: Client): string {
        const nowMs = Date.now();
        const levelScope = getClientLevelScope(client);
        const levelMap = levelScope ? GlobalState.levelEntities.get(levelScope) ?? null : null;
        const playerEntity = client.clientEntID > 0
            ? client.entities.get(client.clientEntID) ?? levelMap?.get(client.clientEntID) ?? null
            : null;
        const lastCombat = SystemHandler.formatLastCombatEvent(client.lastCombatEvent, nowMs);
        const suspectEnemies = SystemHandler.getSuspectEnemies(client, playerEntity, levelMap, nowMs);
        const characterName = String(client.character?.name ?? '(none)');
        const level = String(client.currentLevel || client.character?.CurrentLevel?.name || '(none)');
        const instance = String(client.levelInstanceId || '(none)');
        const roomId = SystemHandler.formatNumber(client.currentRoomId);

        const lines = [
            'Context:',
            `  session: userId=${client.userId ?? '(none)'} token=${client.token || 0} char=${characterName} level=${level} instance=${instance} scope=${levelScope || '(none)'} room=${roomId} playerEnt=${client.clientEntID || 0}`,
            `  lastDoor: id=${client.lastDoorId >= 0 ? client.lastDoorId : '(none)'} target=${client.lastDoorTargetLevel || '(none)'}`,
            `  combat: lastActivityAgeMs=${SystemHandler.formatAgeMs(client.lastCombatActivityAt, nowMs)} hp=${SystemHandler.formatClientHp(client)}`
        ];

        if (client.activeDungeonCutsceneScope) {
            lines.push(
                `  cutscene: activeScope=${client.activeDungeonCutsceneScope} room=${client.activeDungeonCutsceneRoomId || 0}`
            );
        }

        if (playerEntity) {
            lines.push(`  player: ${SystemHandler.formatEntity(playerEntity, client.clientEntID, nowMs, playerEntity)}`);
        }

        if (lastCombat) {
            lines.push(`  lastCombat: ${lastCombat}`);
            const lastCombatDebug = SystemHandler.formatLastCombatDebug(client, client.lastCombatEvent, levelMap);
            if (lastCombatDebug) {
                lines.push(`  lastCombatDebug: ${lastCombatDebug}`);
            }
        }

        if (suspectEnemies.length > 0) {
            lines.push('  suspectEnemies:');
            for (const suspect of suspectEnemies) {
                lines.push(`    - ${suspect}`);
            }
        } else {
            lines.push('  suspectEnemies: none known in current scope');
        }

        return lines.join('\n');
    }

    private static getSuspectEnemies(
        client: Client,
        playerEntity: any,
        levelMap: Map<number, any> | null,
        nowMs: number
    ): string[] {
        const entities = new Map<number, any>();
        if (levelMap) {
            for (const [entityId, entity] of levelMap.entries()) {
                entities.set(entityId, entity);
            }
        }
        for (const [entityId, entity] of client.entities.entries()) {
            entities.set(entityId, entity);
        }

        const playerX = Number(playerEntity?.x ?? NaN);
        const playerY = Number(playerEntity?.y ?? NaN);
        const hasPlayerPosition = Number.isFinite(playerX) && Number.isFinite(playerY);
        const currentRoomId = Number(client.currentRoomId ?? -1);

        const candidates = Array.from(entities.entries())
            .map(([entityId, entity]) => ({
                entityId,
                entity,
                sameRoom: SystemHandler.isSameRoom(currentRoomId, Number(entity?.roomId ?? entity?.room_id ?? -1)),
                distanceSq: hasPlayerPosition
                    ? SystemHandler.getDistanceSq(playerX, playerY, Number(entity?.x ?? NaN), Number(entity?.y ?? NaN))
                    : Number.POSITIVE_INFINITY,
                lastCombatActivityAt: Math.max(0, Math.round(Number(entity?.lastCombatActivityAt ?? 0)))
            }))
            .filter((entry) =>
                entry.entityId > 0 &&
                entry.entity &&
                !entry.entity.isPlayer &&
                Number(entry.entity.team ?? 0) === EntityTeam.ENEMY &&
                !SystemHandler.isEntityDead(entry.entity)
            )
            .sort((left, right) => {
                if (left.sameRoom !== right.sameRoom) {
                    return left.sameRoom ? -1 : 1;
                }

                const leftRecent = nowMs - left.lastCombatActivityAt <= 10_000;
                const rightRecent = nowMs - right.lastCombatActivityAt <= 10_000;
                if (leftRecent !== rightRecent) {
                    return leftRecent ? -1 : 1;
                }

                if (left.distanceSq !== right.distanceSq) {
                    return left.distanceSq - right.distanceSq;
                }

                return left.entityId - right.entityId;
            })
            .slice(0, 8);

        return candidates.map((entry) =>
            SystemHandler.formatEntity(entry.entity, entry.entityId, nowMs, playerEntity)
        );
    }

    private static formatLastCombatEvent(event: ClientCombatEventSnapshot | null, nowMs: number): string {
        if (!event) {
            return '';
        }

        const power = event.powerId !== undefined ? ` powerId=${event.powerId}` : '';
        const damage = event.damage !== undefined ? ` damage=${event.damage}` : '';
        return `${event.packet} ageMs=${SystemHandler.formatAgeMs(event.atMs, nowMs)} scope=${event.levelScope || '(none)'} source=${SystemHandler.formatCombatEndpoint(event.sourceId, event.sourceName, event.sourceTeam, event.sourceRoomId)} target=${SystemHandler.formatCombatEndpoint(event.targetId, event.targetName, event.targetTeam, event.targetRoomId)}${power}${damage}`;
    }

    private static formatLastCombatDebug(
        client: Client,
        event: ClientCombatEventSnapshot | null,
        levelMap: Map<number, any> | null
    ): string {
        if (!event) {
            return '';
        }

        const sourceEntity = SystemHandler.findKnownEntity(client, levelMap, event.sourceId);
        const targetEntity = SystemHandler.findKnownEntity(client, levelMap, event.targetId);
        const sourceName = SystemHandler.getEntityName(sourceEntity) || event.sourceName;
        const targetName = SystemHandler.getEntityName(targetEntity) || event.targetName;
        const power = event.powerId !== undefined
            ? SystemHandler.getCrashDebugData()?.powersById.get(event.powerId) ?? null
            : null;
        const sourceArt = SystemHandler.formatEntityArt(sourceName);
        const targetArt = SystemHandler.formatEntityArt(targetName);
        const sourcePowerSlot = power ? SystemHandler.findEntityPowerSlot(sourceName, power.name) : '';
        const parts = [];

        if (power) {
            parts.push(`power=${power.name}#${power.id}`);
            if (sourcePowerSlot) {
                parts.push(`sourceSlot=${sourcePowerSlot}`);
            }
            if (power.castAnim) {
                parts.push(`castAnim=${power.castAnim}`);
            }
            if (power.targetMethod) {
                parts.push(`targetMethod=${power.targetMethod}`);
            }
            if (power.gfx.length > 0) {
                parts.push(`powerGfx=${power.gfx.join('|')}`);
            }
        } else if (event.powerId !== undefined) {
            parts.push(`powerId=${event.powerId} unresolved`);
        }

        if (sourceArt) {
            parts.push(`sourceArt=${sourceArt}`);
        }
        if (targetArt) {
            parts.push(`targetArt=${targetArt}`);
        }

        return parts.join(' ');
    }

    private static findKnownEntity(client: Client, levelMap: Map<number, any> | null, entityId: number): any {
        return client.entities.get(entityId) ?? levelMap?.get(entityId) ?? null;
    }

    private static formatCombatEndpoint(entityId: number, name: string, team: number, roomId: number): string {
        const label = name || '(unknown)';
        return `${label}#${entityId}(team=${team},room=${SystemHandler.formatNumber(roomId)})`;
    }

    private static formatEntity(entity: any, fallbackId: number, nowMs: number, playerEntity: any): string {
        const entityId = Math.max(0, Math.round(Number(entity?.id ?? fallbackId ?? 0)));
        const name = SystemHandler.getEntityName(entity) || '(unknown)';
        const team = Number(entity?.team ?? 0);
        const roomId = Number(entity?.roomId ?? entity?.room_id ?? -1);
        const rank = GameData.getEntityRank(entity);
        const x = Number(entity?.x ?? NaN);
        const y = Number(entity?.y ?? NaN);
        const distance = SystemHandler.formatDistance(entity, playerEntity);
        const hp = SystemHandler.formatEntityHp(entity);
        const level = Number(entity?.level ?? 0);
        const recentCombat = SystemHandler.formatAgeMs(Number(entity?.lastCombatActivityAt ?? 0), nowMs);
        const ownerToken = Number(entity?.ownerToken ?? 0);
        const flags = [
            entity?.clientSpawned ? 'clientSpawned' : '',
            entity?.untargetable ? 'untargetable' : '',
            ownerToken > 0 ? `ownerToken=${ownerToken}` : ''
        ].filter(Boolean).join(',');
        const art = SystemHandler.formatEntityArt(name);
        const powers = SystemHandler.formatEntityPowers(name);

        return `${name}#${entityId} team=${team} room=${SystemHandler.formatNumber(roomId)} rank=${rank || '(none)'} level=${level || '(unknown)'} pos=(${SystemHandler.formatNumber(x)},${SystemHandler.formatNumber(y)}) dist=${distance} hp=${hp} lastCombatAgeMs=${recentCombat}${flags ? ` flags=${flags}` : ''}${art ? ` art=${art}` : ''}${powers ? ` powers=${powers}` : ''}`;
    }

    private static getEntityName(entity: any): string {
        return String(entity?.name ?? entity?.EntName ?? entity?.entName ?? '').trim();
    }

    private static formatEntityArt(entityName: string): string {
        const entType = SystemHandler.getCrashDebugData()?.entTypes.get(entityName);
        if (!entType) {
            return '';
        }

        const animFile = entType.gfx.AnimFile;
        const animClass = entType.gfx.AnimClass;
        const customArts = Object.entries(entType.gfx)
            .filter(([key, value]) => /^CustomArt\d*$/.test(key) && value)
            .sort(([left], [right]) => SystemHandler.customArtSortIndex(left) - SystemHandler.customArtSortIndex(right))
            .map(([, value]) => value);
        const parts = [];
        if (animFile || animClass) {
            parts.push(`${animFile || '(unknown)'}/${animClass || '(unknown)'}`);
        }
        if (customArts.length > 0) {
            parts.push(`custom=${customArts.join('|')}`);
        }
        return parts.join(',');
    }

    private static formatEntityPowers(entityName: string): string {
        const entType = SystemHandler.getCrashDebugData()?.entTypes.get(entityName);
        if (!entType) {
            return '';
        }

        const powers = [
            entType.values.MeleePower ? `melee:${entType.values.MeleePower}` : '',
            entType.values.RangedPower ? `ranged:${entType.values.RangedPower}` : '',
            entType.values.Powers ? `extra:${entType.values.Powers}` : ''
        ].filter(Boolean);
        return powers.join(',');
    }

    private static findEntityPowerSlot(entityName: string, powerName: string): string {
        const entType = SystemHandler.getCrashDebugData()?.entTypes.get(entityName);
        if (!entType || !powerName) {
            return '';
        }

        if (entType.values.MeleePower === powerName) {
            return 'MeleePower';
        }
        if (entType.values.RangedPower === powerName) {
            return 'RangedPower';
        }

        const extraPowers = String(entType.values.Powers ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
        if (extraPowers.includes(powerName)) {
            return 'Powers';
        }

        return '';
    }

    private static customArtSortIndex(name: string): number {
        const suffix = name.match(/^CustomArt(\d+)$/)?.[1];
        return suffix ? Number(suffix) : 0;
    }

    private static getCrashDebugData(): CrashDebugData | null {
        if (SystemHandler.crashDebugData !== undefined) {
            return SystemHandler.crashDebugData;
        }

        try {
            const entTypesPath = SystemHandler.findClientXmlPath('EntTypes.xml');
            const monsterPowerTypesPath = SystemHandler.findClientXmlPath('MonsterPowerTypes.xml');
            const playerPowerTypesPath = SystemHandler.findClientXmlPath('PlayerPowerTypes.xml');
            if (!entTypesPath) {
                SystemHandler.crashDebugData = null;
                return null;
            }

            const entTypes = SystemHandler.parseEntTypesXml(fs.readFileSync(entTypesPath, 'utf8'));
            const powersById = new Map<number, CrashDebugPower>();
            const powersByName = new Map<string, CrashDebugPower>();
            for (const powerPath of [monsterPowerTypesPath, playerPowerTypesPath]) {
                if (!powerPath) {
                    continue;
                }

                for (const power of SystemHandler.parsePowerTypesXml(
                    fs.readFileSync(powerPath, 'utf8'),
                    path.basename(powerPath)
                )) {
                    powersByName.set(power.name, power);
                    if (power.id > 0) {
                        powersById.set(power.id, power);
                    }
                }
            }

            SystemHandler.crashDebugData = { entTypes, powersById, powersByName };
        } catch {
            SystemHandler.crashDebugData = null;
        }

        return SystemHandler.crashDebugData;
    }

    private static findClientXmlPath(fileName: string): string | null {
        const candidates = [
            path.resolve(Config.DATA_DIR, '..', 'client', 'content', 'xml', fileName),
            path.resolve(Config.DATA_DIR, '..', '..', 'client', 'content', 'xml', fileName),
            path.resolve(process.cwd(), 'src', 'client', 'content', 'xml', fileName),
            path.resolve(process.cwd(), 'client', 'content', 'xml', fileName)
        ];

        return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
    }

    private static parseEntTypesXml(xml: string): Map<string, CrashDebugEntType> {
        const rawTypes = new Map<string, CrashDebugEntType>();
        const entTypePattern = /<EntType\s+([^>]*?)>([\s\S]*?)<\/EntType>/g;
        let match: RegExpExecArray | null;

        while ((match = entTypePattern.exec(xml)) !== null) {
            const attrs = match[1] ?? '';
            const body = match[2] ?? '';
            const name = SystemHandler.getXmlAttribute(attrs, 'EntName') ?? '';
            if (!name) {
                continue;
            }

            const parent = SystemHandler.getXmlAttribute(attrs, 'parent') ?? '';
            const gfxBody = SystemHandler.getXmlTagValue(body, 'GfxType');
            rawTypes.set(name, {
                name,
                parent,
                values: SystemHandler.extractDirectXmlValues(body.replace(/<GfxType>[\s\S]*?<\/GfxType>/g, '')),
                gfx: SystemHandler.extractDirectXmlValues(gfxBody)
            });
        }

        const resolvedTypes = new Map<string, CrashDebugEntType>();
        const resolve = (name: string, stack: Set<string> = new Set()): CrashDebugEntType | null => {
            const cached = resolvedTypes.get(name);
            if (cached) {
                return cached;
            }

            const raw = rawTypes.get(name);
            if (!raw || stack.has(name)) {
                return raw ?? null;
            }

            stack.add(name);
            const parent = raw.parent ? resolve(raw.parent, stack) : null;
            stack.delete(name);

            const resolved = {
                name: raw.name,
                parent: raw.parent,
                values: { ...(parent?.values ?? {}), ...raw.values },
                gfx: { ...(parent?.gfx ?? {}), ...raw.gfx }
            };
            resolvedTypes.set(name, resolved);
            return resolved;
        };

        for (const name of rawTypes.keys()) {
            resolve(name);
        }

        return resolvedTypes;
    }

    private static parsePowerTypesXml(xml: string, sourceFile: string): CrashDebugPower[] {
        const powers: CrashDebugPower[] = [];
        const powerPattern = /<Power\s+([^>]*?)>([\s\S]*?)<\/Power>/g;
        let match: RegExpExecArray | null;

        while ((match = powerPattern.exec(xml)) !== null) {
            const attrs = match[1] ?? '';
            const body = match[2] ?? '';
            const name = SystemHandler.getXmlAttribute(attrs, 'PowerName') ?? '';
            if (!name) {
                continue;
            }

            powers.push({
                name,
                id: Math.max(0, Math.round(Number(SystemHandler.getXmlTagValue(body, 'PowerID') || 0))),
                sourceFile,
                castAnim: SystemHandler.getXmlTagValue(body, 'CastAnim'),
                targetMethod: SystemHandler.getXmlTagValue(body, 'TargetMethod'),
                gfx: SystemHandler.extractPowerGfx(body)
            });
        }

        return powers;
    }

    private static extractPowerGfx(body: string): string[] {
        const result: string[] = [];
        const gfxPattern = /<([A-Za-z0-9_]*Gfx)>([\s\S]*?)<\/\1>/g;
        let match: RegExpExecArray | null;

        while ((match = gfxPattern.exec(body)) !== null) {
            const tagName = match[1] ?? '';
            const gfxBody = match[2] ?? '';
            const animFile = SystemHandler.getXmlTagValue(gfxBody, 'AnimFile');
            const animClass = SystemHandler.getXmlTagValue(gfxBody, 'AnimClass');
            if (animFile || animClass) {
                result.push(`${tagName}:${animFile || '(unknown)'}/${animClass || '(unknown)'}`);
            }
        }

        return result;
    }

    private static extractDirectXmlValues(body: string): Record<string, string> {
        const values: Record<string, string> = {};
        const tagPattern = /<([A-Za-z0-9_]+)>([^<]*)<\/\1>/g;
        let match: RegExpExecArray | null;

        while ((match = tagPattern.exec(body)) !== null) {
            const key = match[1] ?? '';
            const value = SystemHandler.decodeXmlText(match[2] ?? '');
            if (key && value) {
                values[key] = value;
            }
        }

        return values;
    }

    private static getXmlAttribute(attrs: string, name: string): string | null {
        const match = attrs.match(new RegExp(`${name}="([^"]*)"`));
        return match?.[1] ?? null;
    }

    private static getXmlTagValue(body: string, tagName: string): string {
        const match = body.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`));
        return SystemHandler.decodeXmlText(match?.[1] ?? '');
    }

    private static decodeXmlText(value: string): string {
        return value
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .trim();
    }

    private static formatClientHp(client: Client): string {
        const currentHp = Math.round(Number(client.authoritativeCurrentHp ?? 0));
        const maxHp = Math.round(Number(client.authoritativeMaxHp ?? 0));
        return `${currentHp}/${maxHp}`;
    }

    private static formatEntityHp(entity: any): string {
        const hp = Number(entity?.hp ?? NaN);
        const maxHp = Number(entity?.maxHp ?? NaN);
        const healthDelta = Number(entity?.healthDelta ?? entity?.health_delta ?? NaN);
        if (Number.isFinite(hp) && Number.isFinite(maxHp) && maxHp > 0) {
            return `${Math.round(hp)}/${Math.round(maxHp)}`;
        }
        if (Number.isFinite(hp)) {
            return `${Math.round(hp)}/?`;
        }
        if (Number.isFinite(healthDelta) && healthDelta !== 0) {
            return `delta=${Math.round(healthDelta)}`;
        }
        return '(unknown)';
    }

    private static formatDistance(entity: any, playerEntity: any): string {
        const playerX = Number(playerEntity?.x ?? NaN);
        const playerY = Number(playerEntity?.y ?? NaN);
        const entityX = Number(entity?.x ?? NaN);
        const entityY = Number(entity?.y ?? NaN);
        if (
            !Number.isFinite(playerX) ||
            !Number.isFinite(playerY) ||
            !Number.isFinite(entityX) ||
            !Number.isFinite(entityY)
        ) {
            return '(unknown)';
        }

        return String(Math.round(Math.sqrt(SystemHandler.getDistanceSq(playerX, playerY, entityX, entityY))));
    }

    private static getDistanceSq(leftX: number, leftY: number, rightX: number, rightY: number): number {
        if (!Number.isFinite(rightX) || !Number.isFinite(rightY)) {
            return Number.POSITIVE_INFINITY;
        }

        const dx = rightX - leftX;
        const dy = rightY - leftY;
        return dx * dx + dy * dy;
    }

    private static isSameRoom(leftRoomId: number, rightRoomId: number): boolean {
        return Number.isFinite(leftRoomId) &&
            Number.isFinite(rightRoomId) &&
            leftRoomId >= 0 &&
            rightRoomId >= 0 &&
            sharesRoomIds(leftRoomId, rightRoomId);
    }

    private static isEntityDead(entity: any): boolean {
        return Boolean(entity?.dead) || Number(entity?.entState ?? EntityState.ACTIVE) === EntityState.DEAD;
    }

    private static formatAgeMs(atMs: number, nowMs: number): string {
        const value = Math.max(0, Math.round(Number(atMs ?? 0)));
        if (value <= 0) {
            return '(none)';
        }

        return String(Math.max(0, nowMs - value));
    }

    private static formatNumber(value: number): string {
        if (!Number.isFinite(value)) {
            return '(unknown)';
        }

        return String(Math.round(value));
    }
}
