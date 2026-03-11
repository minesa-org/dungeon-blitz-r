import { Client } from '../core/Client';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';
import { LevelConfig } from '../core/LevelConfig';
import { GlobalState } from '../core/GlobalState';
import { WorldEnter } from '../utils/WorldEnter';
import { Config } from '../core/config';
import { NpcLoader, NpcDef } from '../data/NpcLoader';
import { EntityHandler } from './EntityHandler';
import { JsonAdapter } from '../database/JsonAdapter';

const db = new JsonAdapter();

export class LevelHandler {
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
        const target = LevelConfig.getDoorTarget(currentLevel, doorId);
        
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
        let targetLevel = LevelConfig.normalizeLevelName(LevelConfig.getDoorTarget(currentLevel, doorId));

        // Fallback for dungeons: use entry level? 
        // For now, simpler logic.
        
        if (!targetLevel && doorId === 999) {
            targetLevel = "CraftTown";
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

        // 2. Get Old Position
        const oldLevel = LevelConfig.normalizeLevelName(client.currentLevel || "NewbieRoad") || "NewbieRoad";
        const ent = client.entities.get(client.clientEntID);
        let oldX = 0, oldY = 0;

        if (ent) {
            oldX = ent.x;
            oldY = ent.y;
        }

        // 3. Calculate New Spawn
        // Default spawn from config
        const targetSpec = LevelConfig.get(targetLevel);
        const spawn = LevelConfig.getSpawn(targetLevel);
        const newX = spawn.x;
        const newY = spawn.y;

        // 4. Update Character State (PreviousLevel / CurrentLevel) logic
        // Only if coming from a non-dungeon (safe) level
        if (oldLevel && !LevelConfig.get(oldLevel).isDungeon) {
            if (targetLevel === "CraftTown") {
                // Determine if we should save the previous level
                // If we are NOT coming from CraftTown, save it.
                if (oldLevel !== "CraftTown") {
                    client.character.PreviousLevel = { name: oldLevel, x: oldX, y: oldY };
                }
                // If we ARE coming from CraftTown (CraftTown -> CraftTown?), we keep the existing PreviousLevel.
            } else if (targetLevel !== "CraftTown") {
                 // Normal travel: Old level becomes PreviousLevel (if safe)
                 if (oldLevel !== "CraftTown") {
                     client.character.PreviousLevel = { name: oldLevel, x: oldX, y: oldY };
                 }
                 // If we leave CraftTown to a normal zone, we might want to keep CraftTown as previous? 
                 // Python says: "Prefer CurrentLevel if it’s a safe non-CraftTown... elif prev_name..."
                 // Basically, if we are in CraftTown, and go to Field, PreviousLevel in DB is probably where we came from BEFORE CraftTown.
                 // But here we set PreviousLevel to valid safe zones. 
                 
                 // Let's stick to the user request: "CraftTown should have returned the player to NewbieRoad at the first, then last coordinate"
                 // This implies that when entering CraftTown, we saved NewbieRoad.
                 // When leaving CraftTown (via "Return"?), we read PreviousLevel.
                 
                 // If this 0x1D is "Leaving CraftTown", we are just going to `targetLevel`.
                 // If `targetLevel` is NewbieRoad, we just go there.
            }
        }
        
        // Update CurrentLevel to new location
        client.character.CurrentLevel = { name: targetLevel, x: newX, y: newY };

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
                previousLevel: client.character.PreviousLevel?.name || "NewbieRoad"
            });
        }
        
        // 8. Send Enter World (0x21)
        const levelSpec = LevelConfig.get(targetLevel);
        const isHard = targetLevel.endsWith("Hard");
        const newHasCoord = !targetSpec.isDungeon;
        
        const pkt = WorldEnter.buildEnterWorldPacket(
            newToken,
            0, "", false, 0, 0, // Old world info (dummy for now)
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
        // ent.velocityX += deltaVX; // We don't track velocity in simple Entity struct yet?
        // ent.state = entState;
        
        // Update Saved Coords if it's us and safe level
        if (isSelf && client.character) {
             const currentLevel = client.currentLevel || "NewbieRoad";
             // Check if safe level
             const isDungeon = LevelConfig.get(currentLevel).isDungeon;
             
             if (currentLevel === "CraftTown" || !isDungeon) {
                 if (!client.character.CurrentLevel) {
                     client.character.CurrentLevel = { name: currentLevel, x: ent.x, y: ent.y };
                 } else {
                     client.character.CurrentLevel.name = currentLevel; // Ensure name matches
                     client.character.CurrentLevel.x = ent.x;
                     client.character.CurrentLevel.y = ent.y;
                 }
                 // Also ensure PreviousLevel is NOT overwritten here, traversing logic is in 0x1D
             }
            }
    }

}
