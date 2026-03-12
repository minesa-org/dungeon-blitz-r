import { Client, clearKeepTutorialTimers, createKeepTutorialState, KeepTutorialState } from '../core/Client';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';
import { LevelConfig } from '../core/LevelConfig';
import { GlobalState } from '../core/GlobalState';
import { WorldEnter } from '../utils/WorldEnter';
import { Config } from '../core/config';
import { MissionLoader } from '../data/MissionLoader';
import { NpcLoader, NpcDef } from '../data/NpcLoader';
import { MissionID } from '../data/runtime';
import { EntityHandler } from './EntityHandler';
import { JsonAdapter } from '../database/JsonAdapter';

const db = new JsonAdapter();

export class LevelHandler {
    private static readonly FIRST_KEEP_MISSION_ID = MissionID.ClearYourHouse;
    private static readonly MISSION_NOT_STARTED = 0;
    private static readonly MISSION_IN_PROGRESS = 1;
    private static readonly KEEP_TUTORIAL_BOSS_TRIGGER_X = -3200;
    private static readonly KEEP_TUTORIAL_RECOVERY_PRESPAWN_MS = 250;
    private static readonly KEEP_TUTORIAL_RECOVERY_CUTSCENE_MS = 5900;
    private static readonly KEEP_TUTORIAL_RECOVERY_POST_MS = 5000;
    private static readonly KEEP_TUTORIAL_BOSS_SOUND = 'D02_MoodLoop_GoblinHideout';
    private static readonly KEEP_TUTORIAL_BOSS_NAME = 'Ranik, The Geomancer';
    private static readonly KEEP_TUTORIAL_FIRST_PARROT_X = -965;
    private static readonly KEEP_TUTORIAL_SECOND_PARROT_X = -2627;

    private static getCraftTownTutorialState(client: Client): KeepTutorialState | null {
        if (client.currentLevel !== 'CraftTownTutorial') {
            return null;
        }

        if (!client.keepTutorialState) {
            client.keepTutorialState = createKeepTutorialState();
        }

        return client.keepTutorialState;
    }

    private static sendHpUpdate(client: Client, entityId: number, delta: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(entityId);
        bb.writeMethod45(delta);
        client.sendBitBuffer(0x3A, bb);
    }

    private static sendStartSkit(client: Client, entityId: number, dialogueId: number, missionId: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(entityId);
        bb.writeMethod6(dialogueId, 3);
        bb.writeMethod4(missionId);
        client.sendBitBuffer(0x7B, bb);
    }

    private static sendMissionAdded(client: Client, missionId: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(missionId);
        bb.writeMethod11(1, 1);
        client.sendBitBuffer(0x85, bb);
    }

    private static sendQuestProgress(client: Client, percent: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(percent);
        client.sendBitBuffer(0xB7, bb);
    }

    private static sendRoomBossInfo(levelName: string, roomId: number, bossId: number, bossName: string): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(Math.max(0, roomId));
        bb.writeMethod4(bossId);
        bb.writeMethod26(bossName);
        bb.writeMethod4(0);
        bb.writeMethod26('');
        const payload = bb.toBuffer();

        for (const other of GlobalState.sessionsByToken.values()) {
            if (!other.playerSpawned || other.currentLevel !== levelName) {
                continue;
            }
            other.send(0xAC, payload);
        }
    }

    private static sendRoomSound(levelName: string, roomId: number, soundName: string, volume: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(Math.max(0, roomId));
        bb.writeMethod13(soundName);
        bb.writeMethod4(Math.max(0, Math.min(100, Math.round(volume * 100))));
        const payload = bb.toBuffer();

        for (const other of GlobalState.sessionsByToken.values()) {
            if (!other.playerSpawned || other.currentLevel !== levelName) {
                continue;
            }
            other.send(0xA8, payload);
        }
    }

    private static sendNpcState(client: Client, entityId: number, entState: number, facingLeft: boolean): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(entityId);
        bb.writeMethod45(0);
        bb.writeMethod45(0);
        bb.writeMethod45(0);
        bb.writeMethod6(entState, 2);
        bb.writeMethod15(facingLeft);
        bb.writeMethod15(false);
        bb.writeMethod15(false);
        bb.writeMethod15(false);
        bb.writeMethod15(false);
        bb.writeMethod15(false);
        client.sendBitBuffer(0x07, bb);
    }

    private static sendSetUntargetable(client: Client, entityId: number, untargetable: boolean): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(entityId);
        bb.writeMethod15(untargetable);
        client.sendBitBuffer(0xAE, bb);
    }

    private static markCraftTownTutorialBossSeen(client: Client, entityId: number, source: 'client' | 'fallback'): void {
        const state = LevelHandler.getCraftTownTutorialState(client);
        if (!state) {
            return;
        }
        if (!state) {
            return;
        }

        state.bossEntitySeen = entityId;
        state.bossEntitySource = source;

        if (!state.bossInfoSentIds.has(entityId)) {
            LevelHandler.sendRoomBossInfo(
                client.currentLevel,
                client.currentRoomId,
                entityId,
                LevelHandler.KEEP_TUTORIAL_BOSS_NAME
            );
            state.bossInfoSentIds.add(entityId);
        }

        if (!state.bossMusicStarted) {
            LevelHandler.sendRoomSound(
                client.currentLevel,
                client.currentRoomId,
                LevelHandler.KEEP_TUTORIAL_BOSS_SOUND,
                0.9
            );
            state.bossMusicStarted = true;
        }
    }

    private static findCraftTownTutorialBossTemplate(): NpcDef | null {
        let best: NpcDef | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const npc of NpcLoader.getRawNpcsForLevel('CraftTownTutorial')) {
            if (String(npc?.name ?? '') !== 'GoblinShamanHood') {
                continue;
            }

            const distance = Math.abs(Number(npc?.x ?? 0) - 49) + Math.abs(Number(npc?.y ?? 0) - 1459);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = npc;
            }
        }

        return best;
    }

    private static spawnCraftTownTutorialFallbackBoss(client: Client): number | null {
        const state = LevelHandler.getCraftTownTutorialState(client);
        if (!state || !client.currentLevel) {
            return null;
        }

        if (state.bossEntitySeen && state.bossEntitySource === 'fallback') {
            return state.bossEntitySeen;
        }

        const levelMap = GlobalState.levelEntities.get(client.currentLevel) ?? new Map<number, any>();
        if (!GlobalState.levelEntities.has(client.currentLevel)) {
            GlobalState.levelEntities.set(client.currentLevel, levelMap);
        }

        for (const [entityId, entity] of levelMap.entries()) {
            const entityName = String(entity?.name ?? entity?.props?.name ?? '');
            const clientSpawned = Boolean(entity?.clientSpawned ?? entity?.props?.clientSpawned);
            if (entityName === 'GoblinShamanHood' || entityName === 'IntroGoblinShamanHood') {
                if (clientSpawned) {
                    continue;
                }
                client.entities.set(entityId, entity);
                LevelHandler.markCraftTownTutorialBossSeen(client, entityId, 'fallback');
                return entityId;
            }
        }

        const template = LevelHandler.findCraftTownTutorialBossTemplate();
        if (!template) {
            return null;
        }

        const boss = {
            ...template,
            name: 'IntroGoblinShamanHood',
            character_name: ',IntroGoblinShamanHood',
            entState: 2,
            untargetable: true,
            clientSpawned: false
        };

        client.entities.set(boss.id, boss);
        levelMap.set(boss.id, boss);
        EntityHandler.sendEntity(client, boss);
        LevelHandler.markCraftTownTutorialBossSeen(client, boss.id, 'fallback');
        return boss.id;
    }

    private static activateCraftTownTutorialBoss(client: Client, bossId: number): void {
        const state = LevelHandler.getCraftTownTutorialState(client);
        if (!state || state.bossDefeated || !client.currentLevel) {
            return;
        }

        const boss = client.entities.get(bossId);
        if (!boss) {
            return;
        }

        boss.untargetable = false;
        boss.entState = 0;

        const levelMap = GlobalState.levelEntities.get(client.currentLevel);
        const levelBoss = levelMap?.get(bossId);
        if (levelBoss) {
            levelBoss.untargetable = false;
            levelBoss.entState = 0;
        }

        LevelHandler.sendSetUntargetable(client, bossId, false);
        LevelHandler.sendNpcState(client, bossId, 0, Boolean(boss.facing_left ?? boss.facingLeft));
    }

    private static armCraftTownTutorialBossRecovery(client: Client): void {
        const state = LevelHandler.getCraftTownTutorialState(client);
        if (!state || state.bossRecoveryArmed || state.bossDefeated) {
            return;
        }

        state.bossRecoveryArmed = true;
        clearKeepTutorialTimers(state);

        const levelName = client.currentLevel;
        state.recoverySpawnTimer = setTimeout(() => {
            if (client.currentLevel !== levelName || state.bossDefeated) {
                return;
            }
            LevelHandler.spawnCraftTownTutorialFallbackBoss(client);
        }, LevelHandler.KEEP_TUTORIAL_RECOVERY_PRESPAWN_MS);

        state.recoveryActivateTimer = setTimeout(() => {
            if (client.currentLevel !== levelName || state.bossDefeated) {
                return;
            }

            const bossId = state.bossEntitySeen ?? LevelHandler.spawnCraftTownTutorialFallbackBoss(client);
            if (!bossId) {
                return;
            }

            const boss = client.entities.get(bossId);
            const stillLocked = !boss || Boolean(boss.untargetable) || Number(boss.entState ?? 0) === 2;
            if (state.bossEntitySource === 'fallback' || stillLocked) {
                LevelHandler.activateCraftTownTutorialBoss(client, bossId);
            }
        }, LevelHandler.KEEP_TUTORIAL_RECOVERY_PRESPAWN_MS +
            LevelHandler.KEEP_TUTORIAL_RECOVERY_CUTSCENE_MS +
            LevelHandler.KEEP_TUTORIAL_RECOVERY_POST_MS);
    }

    private static selectCraftTownTutorialLastGuyId(client: Client): number | null {
        let bestId: number | null = null;
        let bestX = Number.NEGATIVE_INFINITY;

        for (const [entityId, entity] of client.entities.entries()) {
            if (String(entity?.name ?? '') !== 'GoblinDagger') {
                continue;
            }

            const cueName = String(entity?.characterName ?? entity?.character_name ?? '');
            if (cueName === 'am_LastGuy') {
                return entityId;
            }

            const dramaAnim = String(entity?.dramaAnim ?? entity?.DramaAnim ?? '');
            const sleepAnim = String(entity?.sleepAnim ?? entity?.SleepAnim ?? '');
            const entState = Number(entity?.entState ?? 0);
            if (dramaAnim === 'Board' || entState === 2 || sleepAnim) {
                continue;
            }

            const entityX = Number(entity?.x ?? 0);
            if (entityX > bestX) {
                bestX = entityX;
                bestId = entityId;
            }
        }

        return bestId;
    }

    private static findNearestCraftTownTutorialEntity(
        client: Client,
        names: Set<string>,
        refX: number,
        refY: number
    ): { entityId: number | null; distance: number | null } {
        let bestId: number | null = null;
        let bestDistance: number | null = null;

        for (const [entityId, entity] of client.entities.entries()) {
            if (!names.has(String(entity?.name ?? ''))) {
                continue;
            }

            const entityX = Number(entity?.x ?? 0);
            const entityY = Number(entity?.y ?? 0);
            const distance = Math.abs(entityX - refX) + Math.abs(entityY - refY);
            if (bestDistance === null || distance < bestDistance) {
                bestDistance = distance;
                bestId = entityId;
            }
        }

        return { entityId: bestId, distance: bestDistance };
    }

    private static findCraftTownTutorialParrotId(client: Client, targetX: number): number | null {
        let bestId: number | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const [entityId, entity] of client.entities.entries()) {
            if (String(entity?.name ?? '') !== 'IntroParrot') {
                continue;
            }

            const distance = Math.abs(Number(entity?.x ?? 0) - targetX);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestId = entityId;
            }
        }

        return bestId;
    }

    private static maybeTriggerCraftTownTutorialParrot(client: Client, newX: number): void {
        const state = LevelHandler.getCraftTownTutorialState(client);
        if (!state || state.bossDefeated) {
            return;
        }

        const player = client.entities.get(client.clientEntID);
        const playerX = Number(player?.x ?? newX);
        const playerY = Number(player?.y ?? 0);

        if (state.phase < 1 && newX <= -900) {
            const parrotId = LevelHandler.findCraftTownTutorialParrotId(
                client,
                LevelHandler.KEEP_TUTORIAL_FIRST_PARROT_X
            );
            if (parrotId !== null) {
                LevelHandler.sendStartSkit(client, parrotId, 0, LevelHandler.FIRST_KEEP_MISSION_ID);
            }
            state.phase = 1;
            return;
        }

        if (state.phase < 2 && newX <= -2400) {
            const parrotId = LevelHandler.findCraftTownTutorialParrotId(
                client,
                LevelHandler.KEEP_TUTORIAL_SECOND_PARROT_X
            );
            if (parrotId !== null) {
                LevelHandler.sendStartSkit(client, parrotId, 0, LevelHandler.FIRST_KEEP_MISSION_ID);
            }
            state.phase = 2;
            return;
        }

        if (state.phase >= 3) {
            return;
        }

        const oldMan = LevelHandler.findNearestCraftTownTutorialEntity(
            client,
            new Set(['NPCHomeGemMerchant']),
            playerX,
            playerY
        );

        const reachedBossTrigger =
            newX <= LevelHandler.KEEP_TUTORIAL_BOSS_TRIGGER_X ||
            (state.phase >= 2 && oldMan.entityId !== null && Number(oldMan.distance ?? 999999) <= 700);

        if (reachedBossTrigger) {
            LevelHandler.maybeTriggerCraftTownTutorialBossIntro(client, newX);
        }
    }

    private static maybeTriggerCraftTownTutorialBossIntro(client: Client, newX: number): void {
        const state = LevelHandler.getCraftTownTutorialState(client);
        if (!state || state.bossDefeated || state.bossIntroForced) {
            return;
        }

        const lastGuyId = LevelHandler.selectCraftTownTutorialLastGuyId(client);
        state.phase = 3;
        state.bossIntroForced = true;
        state.forcedLastGuyId = lastGuyId;

        if (lastGuyId !== null) {
            LevelHandler.sendHpUpdate(client, lastGuyId, -999999);
            client.entities.delete(lastGuyId);

            const levelMap = GlobalState.levelEntities.get(client.currentLevel);
            levelMap?.delete(lastGuyId);
            if (levelMap && levelMap.size === 0) {
                GlobalState.levelEntities.delete(client.currentLevel);
            }

            LevelHandler.sendDestroyEntity(client.currentLevel, lastGuyId);
        }

        LevelHandler.armCraftTownTutorialBossRecovery(client);
    }

    private static getCharacterMissionState(character: any, missionId: number): number {
        const missions = character?.missions;
        if (!missions || typeof missions !== 'object' || Array.isArray(missions)) {
            return LevelHandler.MISSION_NOT_STARTED;
        }

        const entry = missions[String(missionId)];
        return Number(entry?.state ?? LevelHandler.MISSION_NOT_STARTED);
    }

    private static canStartMission(character: any, missionId: number): boolean {
        const missionDef = MissionLoader.getMissionDef(missionId);
        if (!missionDef) {
            return false;
        }

        for (const prereqName of missionDef.PreReqMissions ?? []) {
            const prereqId = MissionLoader.getMissionIdByName(prereqName);
            if (!prereqId) {
                continue;
            }
            if (LevelHandler.getCharacterMissionState(character, prereqId) < 3) {
                return false;
            }
        }

        return true;
    }

    static async prepareCraftTownTutorialEntry(client: Client): Promise<void> {
        if (client.currentLevel !== 'CraftTownTutorial' || !client.character) {
            return;
        }

        const state = LevelHandler.getCraftTownTutorialState(client);

        const missionState = LevelHandler.getCharacterMissionState(client.character, LevelHandler.FIRST_KEEP_MISSION_ID);
        if (
            missionState === LevelHandler.MISSION_NOT_STARTED &&
            LevelHandler.canStartMission(client.character, LevelHandler.FIRST_KEEP_MISSION_ID)
        ) {
            const missions =
                client.character.missions &&
                typeof client.character.missions === 'object' &&
                !Array.isArray(client.character.missions)
                    ? client.character.missions
                    : {};

            missions[String(LevelHandler.FIRST_KEEP_MISSION_ID)] = {
                ...(missions[String(LevelHandler.FIRST_KEEP_MISSION_ID)] ?? {}),
                state: LevelHandler.MISSION_IN_PROGRESS,
                currCount: 0
            };
            delete missions[String(LevelHandler.FIRST_KEEP_MISSION_ID)].claimed;
            delete missions[String(LevelHandler.FIRST_KEEP_MISSION_ID)].complete;
            client.character.missions = missions;
            client.character.questTrackerState = 0;

            LevelHandler.sendMissionAdded(client, LevelHandler.FIRST_KEEP_MISSION_ID);
            LevelHandler.sendQuestProgress(client, 0);

            if (client.userId) {
                await db.saveCharacters(client.userId, client.characters);
            }
        }

        if (state!.introSkitSent) {
            return;
        }

        const levelMap = GlobalState.levelEntities.get(client.currentLevel);
        if (!levelMap) {
            return;
        }

        const playerX = Number(client.character.CurrentLevel?.x ?? 0);
        const playerY = Number(client.character.CurrentLevel?.y ?? 0);
        let parrotId: number | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const [entityId, entity] of levelMap.entries()) {
            if (String(entity?.name ?? entity?.props?.name ?? '') !== 'IntroParrot') {
                continue;
            }

            const entityX = Number(entity?.x ?? entity?.props?.x ?? entity?.props?.pos_x ?? 0);
            const entityY = Number(entity?.y ?? entity?.props?.y ?? entity?.props?.pos_y ?? 0);
            const distance = Math.abs(entityX - playerX) + Math.abs(entityY - playerY);
            if (distance < bestDistance) {
                bestDistance = distance;
                parrotId = entityId;
            }
        }

        if (parrotId !== null) {
            LevelHandler.sendStartSkit(client, parrotId, 0, LevelHandler.FIRST_KEEP_MISSION_ID);
            state!.introSkitSent = true;
        }
    }

    private static async refreshCurrentCharacterFromSave(client: Client): Promise<void> {
        if (!client.userId || !client.character) {
            return;
        }

        const latestCharacters = await db.loadCharacters(client.userId);
        client.characters = latestCharacters;

        const currentName = String(client.character.name ?? '').trim().toLowerCase();
        const latestCharacter = latestCharacters.find((entry) =>
            String(entry?.name ?? '').trim().toLowerCase() === currentName
        );

        if (latestCharacter) {
            client.character = latestCharacter;
        } else {
            latestCharacters.push(client.character);
            client.characters = latestCharacters;
        }
    }

    private static sendDestroyEntity(levelName: string, entityId: number): void {
        const bb = new BitBuffer(false);
        bb.writeMethod4(entityId);
        bb.writeMethod15(false);
        const payload = bb.toBuffer();

        for (const other of GlobalState.sessionsByToken.values()) {
            if (!other.playerSpawned || other.currentLevel !== levelName) {
                continue;
            }
            other.send(0x0D, payload);
        }
    }

    private static clearTransferState(client: Client, oldLevel: string, oldClientEntId: number): void {
        if (oldClientEntId > 0 && oldLevel) {
            LevelHandler.sendDestroyEntity(oldLevel, oldClientEntId);
        }

        clearKeepTutorialTimers(client.keepTutorialState);
        client.keepTutorialState = null;
        client.clientSpawnConfirmed = false;
        client.entities.delete(oldClientEntId);
        EntityHandler.removeOwnedEntities(client);
        client.clientEntID = 0;
        client.playerSpawned = false;
        client.pendingLoot.clear();
        client.processedRewardSources.clear();
        client.currentRoomId = 0;
        client.startedRoomEvents.clear();
    }

    private static forLevelRecipients(client: Client, includeSender: boolean = false): Client[] {
        const levelName = client.currentLevel;
        if (!levelName) {
            return [];
        }

        const recipients: Client[] = [];
        for (const other of GlobalState.sessionsByToken.values()) {
            if (!other.playerSpawned || other.currentLevel !== levelName) {
                continue;
            }
            if (!includeSender && other === client) {
                continue;
            }
            recipients.push(other);
        }

        return recipients;
    }

    private static relayToLevel(client: Client, packetId: number, data: Buffer, includeSender: boolean = false): void {
        for (const other of LevelHandler.forLevelRecipients(client, includeSender)) {
            other.send(packetId, data);
        }
    }

    private static cacheRoomId(client: Client, roomId: number): void {
        if (Number.isFinite(roomId) && roomId >= 0) {
            client.currentRoomId = roomId;
        }
    }

    private static markRoomEventStarted(client: Client, roomId: number): void {
        if (!client.currentLevel) {
            return;
        }
        client.startedRoomEvents.add(`${client.currentLevel}:${roomId}`);
    }

    private static getMissionState(client: Client, missionId: number): number {
        const missions = client.character?.missions;
        if (!missions || typeof missions !== 'object' || Array.isArray(missions)) {
            return LevelHandler.MISSION_NOT_STARTED;
        }

        const entry = missions[String(missionId)];
        const state = entry && typeof entry === 'object' ? entry.state : undefined;
        return Number(state ?? LevelHandler.MISSION_NOT_STARTED);
    }

    private static resolveDoorTarget(client: Client, currentLevel: string, doorId: number): string | null {
        if (
            doorId === 999 &&
            currentLevel !== 'CraftTownTutorial' &&
            LevelHandler.getMissionState(client, LevelHandler.FIRST_KEEP_MISSION_ID) ===
                LevelHandler.MISSION_IN_PROGRESS
        ) {
            return 'CraftTownTutorial';
        }

        return LevelConfig.getDoorTarget(currentLevel, doorId);
    }

    private static hasRoomEventStarted(client: Client, roomId: number): boolean {
        if (!client.currentLevel) {
            return false;
        }
        return client.startedRoomEvents.has(`${client.currentLevel}:${roomId}`);
    }

    static sendRoomEventStart(client: Client, roomId: number, flag: boolean): void {
        const bb = new BitBuffer(false);
        bb.writeMethod9(roomId);
        bb.writeMethod15(flag);
        client.sendBitBuffer(0xA5, bb);
        LevelHandler.markRoomEventStarted(client, roomId);
    }

    static primeTutorialRoomEvents(client: Client): void {
        if (!['TutorialBoat', 'TutorialDungeon', 'CraftTownTutorial'].includes(client.currentLevel)) {
            return;
        }

        for (const roomId of [0, 1]) {
            if (!LevelHandler.hasRoomEventStarted(client, roomId)) {
                LevelHandler.sendRoomEventStart(client, roomId, true);
            }
        }
    }

    static handleRequestDoorState(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const doorId = br.readMethod9();
        
        // Lookup door target in LevelConfig
        const currentLevel = client.currentLevel || "NewbieRoad";
        const target = LevelHandler.resolveDoorTarget(client, currentLevel, doorId);
        
        const bb = new BitBuffer();
        bb.writeMethod4(doorId);
        
        if (target) {
            // If target exists, door is open/usable (State 1 = Static/Open)
            bb.writeMethod91(1); // DOORSTATE_STATIC
            bb.writeMethod13(target);
        } else {
            // Locked or unknown (State 0 = Locked)
            bb.writeMethod91(0); // DOORSTATE_LOCKED
            bb.writeMethod13("");
        }

        client.sendBitBuffer(0x42, bb);
    }

    static spawnLevelNpcs(client: Client, levelName: string): void {
        EntityHandler.sendInitialLevelEntities(client, levelName);
    }

    // 0x2D: Open Door
    static handleOpenDoor(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const doorId = br.readMethod9();

        const currentLevel = LevelConfig.normalizeLevelName(client.currentLevel || "NewbieRoad") || "NewbieRoad";
        let targetLevel = LevelConfig.normalizeLevelName(
            LevelHandler.resolveDoorTarget(client, currentLevel, doorId)
        );

        if (!targetLevel && doorId === 999) {
            targetLevel = "CraftTown";
        }

        if (!targetLevel && LevelConfig.isDungeonLevel(currentLevel) && client.entryLevel) {
            targetLevel = LevelConfig.normalizeLevelName(client.entryLevel);
        }

        if (!targetLevel) {
            targetLevel = currentLevel;
        }

        console.log(`[Level] Open Door ${doorId} in ${currentLevel} -> ${targetLevel}`);

        // Send 0x2E Door Target
        if (targetLevel) {
            client.lastDoorId = doorId;
            client.lastDoorTargetLevel = targetLevel;
            const bb = new BitBuffer();
            bb.writeMethod4(doorId);
            bb.writeMethod13(targetLevel);
            client.sendBitBuffer(0x2E, bb);
        }
    }

    static handleQuestProgressUpdate(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const progress = br.readMethod4();

        if (client.character) {
            client.character.questTrackerState = progress;
        }

        LevelHandler.relayToLevel(client, 0xB7, data);
    }

    static handlePlaySound(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);
        br.readMethod26();
        br.readMethod9();

        LevelHandler.relayToLevel(client, 0xA8, data);
    }

    static handleActionUpdate(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);
        br.readMethod9();

        LevelHandler.relayToLevel(client, 0xAA, data);
    }

    static handleRoomStateUpdate(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);
        br.readMethod9();

        LevelHandler.relayToLevel(client, 0xA9, data);
    }

    static handleRoomEventStart(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);
        br.readMethod15();
        LevelHandler.markRoomEventStarted(client, roomId);

        LevelHandler.relayToLevel(client, 0xA5, data);
    }

    static handleRoomInfoUpdate(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);
        br.readMethod9();
        br.readMethod26();
        br.readMethod9();
        br.readMethod26();

        LevelHandler.relayToLevel(client, 0xAB, data);
    }

    static handleRoomClose(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);

        LevelHandler.relayToLevel(client, 0xA6, data);
    }

    static handleRoomUnlock(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);

        LevelHandler.relayToLevel(client, 0xAD, data);
    }

    static handleRoomBossInfo(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const roomId = br.readMethod9();
        LevelHandler.cacheRoomId(client, roomId);
        br.readMethod9();
        br.readMethod26();
        br.readMethod9();
        br.readMethod26();

        LevelHandler.relayToLevel(client, 0xAC, data);
    }

    static handleSetUntargetable(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        br.readMethod4();
        br.readMethod15();

        LevelHandler.relayToLevel(client, 0xAE, data);
    }

    static handleChangeOffsetY(client: Client, data: Buffer): void {
        const br = new BitReader(data);
        const entityId = br.readMethod4();
        const offsetY = br.readMethod739();

        const entity = client.entities.get(entityId);
        if (entity) {
            entity.renderDepthOffset = offsetY;
            entity.targetOffsetY = offsetY;
        }

        LevelHandler.relayToLevel(client, 0x7D, data);
    }

    // 0x1D: Level Transfer Request
    static async handleLevelTransferRequest(client: Client, data: Buffer): Promise<void> {
        const br = new BitReader(data);
        const token = br.readMethod9();
        const requestedLevelRaw = br.readMethod13();
        const requestedLevel = LevelConfig.normalizeLevelName(requestedLevelRaw);
        const lastDoorTarget = LevelConfig.normalizeLevelName(client.lastDoorTargetLevel);

        console.log(`[Level] Transfer Request (0x1D): Token=${token}, Level=${requestedLevelRaw}`);

        // Safety: ensure client is authenticated or token matches
        if (!client.character) {
             // Attempt to recover session from token
             const entry = GlobalState.tokenChar.get(token);
             if (entry) {
                 client.character = entry.character;
                 client.userId = entry.userId;
                 console.log(`[Level] Recovered session for user ${client.userId} (Char: ${client.character.name}) using token ${token}`);
             } else {
                 console.error(`[Level] No character on session during transfer request. Token=${token} not found in tokenChar.`);
                 console.log(`[Level] Available tokens: ${Array.from(GlobalState.tokenChar.keys()).join(", ")}`);
                 return;
             }
        }

        // 1. Determine Target Level
        let targetLevel = requestedLevel;
        if (!targetLevel || targetLevel === "None") {
            if (lastDoorTarget && LevelConfig.has(lastDoorTarget)) {
                targetLevel = lastDoorTarget;
                console.log(`[Level] Using last door target for transfer: ${targetLevel}`);
            } else {
                targetLevel = "NewbieRoad";
            }
        } else if (!LevelConfig.has(targetLevel) && lastDoorTarget && LevelConfig.has(lastDoorTarget)) {
            console.log(`[Level] Invalid transfer target '${targetLevel}', falling back to last door target ${lastDoorTarget}`);
            targetLevel = lastDoorTarget;
        }

        if (!LevelConfig.has(targetLevel)) {
            const safeFallback = LevelConfig.normalizeLevelName(client.currentLevel || "NewbieRoad") || "NewbieRoad";
            console.log(`[Level] Unresolved transfer target '${targetLevel}', staying in ${safeFallback}`);
            targetLevel = safeFallback;
        }

        await LevelHandler.refreshCurrentCharacterFromSave(client);

        const currentLevelRecord = client.character.CurrentLevel;
        const oldLevel = LevelConfig.normalizeLevelName(currentLevelRecord?.name || client.currentLevel || "NewbieRoad") || "NewbieRoad";
        const ent = client.entities.get(client.clientEntID);
        let oldX = 0, oldY = 0;
        let hasOldCoord = false;

        if (ent) {
            oldX = ent.x;
            oldY = ent.y;
            hasOldCoord = Number.isFinite(oldX) && Number.isFinite(oldY);
        }

        const oldClientEntId = client.clientEntID;
        LevelHandler.clearTransferState(client, oldLevel, oldClientEntId);

        // 3. Calculate New Spawn / save logic like Python
        const spawn = LevelConfig.getSpawnCoordinates(client.character, oldLevel, targetLevel);
        const newX = spawn.x;
        const newY = spawn.y;
        const newHasCoord = spawn.hasCoord;
        LevelConfig.updateSavedLevelsOnTransfer(client.character, oldLevel, targetLevel, newX, newY);

        if (client.userId) {
            await db.saveCharacters(client.userId, client.characters);
        }

        // 5. Generate New Token
        const newToken = Math.floor(Math.random() * 0xFFFF);
        
        // 6. Check House Visit Override
        let hostChar = client.character;
        // Use token from packet (0x1D) to lookup house visit
        if (GlobalState.houseVisits.has(token)) {
            hostChar = GlobalState.houseVisits.get(token)!;
            GlobalState.houseVisits.delete(token); // Consume
            console.log(`[Level] House Visit active! Host: ${hostChar.name}`);
        }

        // 7. Store Pending Transfer State
        if (client.userId) {
            GlobalState.pendingWorld.set(newToken, {
                character: client.character,
                userId: client.userId,
                targetLevel: targetLevel,
                previousLevel: oldLevel,
                newX,
                newY,
                newHasCoord
            });
        }
        GlobalState.pendingExtended.set(newToken, false);
        
        // 8. Send Enter World (0x21)
        const levelSpec = LevelConfig.get(targetLevel);
        const isHard = targetLevel.endsWith("Hard");
        const oldLevelSpec = LevelConfig.get(oldLevel);
        
        const pkt = WorldEnter.buildEnterWorldPacket(
            newToken,
            0,
            oldLevelSpec.swf,
            hasOldCoord,
            Math.round(oldX),
            Math.round(oldY),
            Config.HOST,
            Config.PORTS[0],
            levelSpec.swf,
            levelSpec.mapId,
            levelSpec.baseId,
            targetLevel,
            isHard ? "Hard" : "",
            isHard ? "Hard" : "",
            levelSpec.isDungeon,
            newHasCoord, newX, newY,
            hostChar
        );

        client.sendBitBuffer(0x21, pkt);
    }

    // 0x07: Incremental Update (Movement)
    static handleEntityIncrementalUpdate(client: Client, data: Buffer): void {
        // data passed from Client is already the payload (header stripped)
        const br = new BitReader(data);
        const entityId = br.readMethod4();
        const isSelf = (entityId === client.clientEntID);

        // If it's us and we haven't spawned, ignore
        // In TS we don't track 'player_spawned' explicitly like python yet, but usually we can ignore.
        
        const deltaX = br.readMethod45();
        const deltaY = br.readMethod45();
        const deltaVX = br.readMethod45();

        const STATE_BITS = 2; // Entity.const_316
        const entState = br.readMethod6(STATE_BITS);

        const flags = {
            bLeft: br.readMethod15(),
            bRunning: br.readMethod15(),
            bJumping: br.readMethod15(),
            bDropping: br.readMethod15(),
            bBackpedal: br.readMethod15()
        };

        const isAirborne = br.readMethod15();
        const velocityY = isAirborne ? br.readMethod24() : 0;

        // Update Entity
        if (!client.entities) return;
        const ent = client.entities.get(entityId);
        if (!ent) return;

        ent.x += deltaX;
        ent.y += deltaY;
        ent.v = Number(ent.v ?? 0) + deltaVX;
        ent.entState = entState;
        ent.facingLeft = flags.bLeft;
        ent.bRunning = flags.bRunning;
        ent.bJumping = flags.bJumping;
        ent.bDropping = flags.bDropping;
        ent.bBackpedal = flags.bBackpedal;
        ent.velocityY = velocityY;
        ent.airborne = isAirborne;
        
        // Update Saved Coords if it's us and safe level
        if (isSelf && client.character) {
            const currentLevel = client.currentLevel || "NewbieRoad";
            const isDungeon = LevelConfig.get(currentLevel).isDungeon;
            
            if (currentLevel === "CraftTown" || !isDungeon) {
                if (!client.character.CurrentLevel) {
                    client.character.CurrentLevel = { name: currentLevel, x: ent.x, y: ent.y };
                } else {
                    client.character.CurrentLevel.name = currentLevel;
                    client.character.CurrentLevel.x = ent.x;
                    client.character.CurrentLevel.y = ent.y;
                }
            }

            if (currentLevel === 'CraftTownTutorial') {
                LevelHandler.maybeTriggerCraftTownTutorialParrot(client, Number(ent.x ?? 0));
            }
        }

        LevelHandler.relayToLevel(client, 0x07, data);
    }

}
