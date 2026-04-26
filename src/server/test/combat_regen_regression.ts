import { strict as assert } from 'assert';
import { GlobalState } from '../core/GlobalState';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';
import { CombatHandler } from '../handlers/CombatHandler';
import { CommandHandler } from '../handlers/CommandHandler';
import { Entity, EntityState } from '../core/Entity';
import { getClientLevelScope } from '../core/LevelScope';
import { AILogic } from '../core/AILogic';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    playerSpawned: boolean;
    clientEntID: number;
    userId: number | null;
    character: { name: string; level: number; class?: string; MasterClass?: number; CurrentLevel?: { name: string; x: number; y: number } } | null;
    authoritativeMaxHp: number;
    authoritativeCurrentHp: number;
    combatStatsDirty: boolean;
    lastCombatStatsRefreshRequestAt: number;
    lastCombatActivityAt: number;
    lastCombatRegenTickAt: number;
    enemyDeathRegenArmed: boolean;
    processedRewardSources: Set<string>;
    pendingLoot: Map<number, any>;
    knownEntityIds: Set<number>;
    entities: Map<number, any>;
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, payload: BitBuffer) => void;
};

function resetState(): void {
    GlobalState.sessionsByToken.clear();
    GlobalState.sessionsByUserId.clear();
    GlobalState.sessionsByCharacterName.clear();
    GlobalState.levelEntities.clear();
    GlobalState.levelQuestProgress.clear();
    GlobalState.combatContributions.clear();
    GlobalState.entityLifeNonces.clear();
    GlobalState.entityLastRewardNonces.clear();
}

function createFakeClient(token: number, name: string, roomId: number): FakeClient {
    const sentPackets: SentPacket[] = [];

    return {
        token,
        currentLevel: 'BridgeTown',
        levelInstanceId: '',
        currentRoomId: roomId,
        playerSpawned: true,
        clientEntID: token + 1000,
        userId: token,
        character: {
            name,
            level: 10,
            class: 'mage',
            MasterClass: 0,
            CurrentLevel: { name: 'BridgeTown', x: 0, y: 0 }
        },
        authoritativeMaxHp: 1000,
        authoritativeCurrentHp: 1000,
        combatStatsDirty: false,
        lastCombatStatsRefreshRequestAt: 0,
        lastCombatActivityAt: 0,
        lastCombatRegenTickAt: 0,
        enemyDeathRegenArmed: false,
        processedRewardSources: new Set<string>(),
        pendingLoot: new Map<number, any>(),
        knownEntityIds: new Set<number>(),
        entities: new Map<number, any>(),
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, payload: BitBuffer) {
            sentPackets.push({ id, payload: payload.toBuffer() });
        }
    };
}

function attachPlayerEntity(session: FakeClient): void {
    const entity = {
        ...Entity.fromCharacter(session.clientEntID, session.character as any, {
            x: 0,
            y: 0,
            team: 1,
            entState: EntityState.ACTIVE,
            roomId: session.currentRoomId
        }),
        ownerToken: session.token,
        ownerUserId: session.userId ?? 0,
        roomId: session.currentRoomId,
        hp: session.authoritativeCurrentHp,
        maxHp: session.authoritativeMaxHp
    };

    session.entities.set(session.clientEntID, entity);
    session.knownEntityIds.add(session.clientEntID);

    const levelScope = getClientLevelScope(session as never);
    let levelMap = GlobalState.levelEntities.get(levelScope);
    if (!levelMap) {
        levelMap = new Map<number, any>();
        GlobalState.levelEntities.set(levelScope, levelMap);
    }
    levelMap.set(session.clientEntID, entity);
}

function parseRegenPacket(payload: Buffer): { entityId: number; amount: number } {
    const br = new BitReader(payload);
    return {
        entityId: br.readMethod4(),
        amount: br.readMethod4()
    };
}

function buildCombatStatsPayload(meleeDamage: number, magicDamage: number, maxHp: number, scale: number, revision: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod9(meleeDamage);
    bb.writeMethod9(magicDamage);
    bb.writeMethod9(maxHp);
    bb.writeMethod20(4, scale);
    bb.writeMethod9(revision);
    return bb.toBuffer();
}

function testPlayerRegenAfterIdleDoesNotHealLivingPlayerBoss(): void {
    resetState();

    const nowMs = 10_000;
    const player = createFakeClient(1, 'Alpha', 3);
    player.authoritativeCurrentHp = 600;
    player.lastCombatActivityAt = nowMs - 6000;

    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.hp = 600;
    playerEntity.maxHp = 1000;

    const hostileId = 900001;
    const hostile = {
        id: hostileId,
        name: 'GoblinBoss2',
        isPlayer: false,
        clientSpawned: true,
        team: 2,
        entRank: 'Boss',
        roomId: player.currentRoomId,
        entState: EntityState.ACTIVE,
        dead: false,
        hp: 400,
        maxHp: 1000,
        lastCombatActivityAt: nowMs - 6000,
        lastCombatRegenTickAt: 0
    };
    player.entities.set(hostileId, hostile);

    const levelScope = getClientLevelScope(player as never);
    GlobalState.levelEntities.get(levelScope)!.set(hostileId, hostile);
    GlobalState.sessionsByToken.set(player.token, player as never);

    CombatHandler.processOutOfCombatRegen(levelScope, nowMs);

    assert.equal(player.authoritativeCurrentHp, 700, 'player should recover 10% of max HP after the idle window');
    assert.equal(playerEntity.hp, 700, 'player entity snapshot should track regenerated HP');
    assert.equal(hostile.hp, 400, 'bosses should not regenerate from idle time while the player is alive');

    const regenPackets = player.sentPackets.filter((packet) => packet.id === 0x3B);
    assert.equal(regenPackets.length, 1, 'player should only receive self regen while alive');

    const [selfPacket] = regenPackets.map((packet) => parseRegenPacket(packet.payload));
    assert.deepEqual(selfPacket, { entityId: player.clientEntID, amount: 100 });
}

function testPlayerRegenUsesEntityHealEncoding(): void {
    resetState();

    const nowMs = 10_000;
    const player = createFakeClient(3, 'Gamma', 7);
    player.character!.level = 2;
    player.authoritativeMaxHp = 8031;
    player.authoritativeCurrentHp = 6306;
    player.lastCombatActivityAt = nowMs - 6000;

    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.hp = 6306;
    playerEntity.maxHp = 8031;

    const levelScope = getClientLevelScope(player as never);
    GlobalState.sessionsByToken.set(player.token, player as never);

    CombatHandler.processOutOfCombatRegen(levelScope, nowMs);

    assert.equal(player.authoritativeCurrentHp, 7109, 'player should recover 803 HP from 6306/8031 after the idle window');

    const regenPacket = player.sentPackets.find((packet) => packet.id === 0x3B);
    assert.ok(regenPacket, 'player regen should emit the heal packet');
    assert.deepEqual(parseRegenPacket(regenPacket!.payload), {
        entityId: player.clientEntID,
        amount: 803
    });
}

function testAiHeartbeatContinuesPlayerRegenUntilFull(): void {
    resetState();

    const player = createFakeClient(4, 'Delta', 9);
    player.character!.level = 2;
    player.authoritativeMaxHp = 8031;
    player.authoritativeCurrentHp = 6306;
    player.lastCombatActivityAt = 4_000;

    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.hp = 6306;
    playerEntity.maxHp = 8031;

    const levelScope = getClientLevelScope(player as never);
    GlobalState.sessionsByToken.set(player.token, player as never);

    const originalDateNow = Date.now;
    try {
        Date.now = () => 10_000;
        AILogic.updateLevel(levelScope);
        assert.equal(player.authoritativeCurrentHp, 7109, 'first server heartbeat tick should heal 803 HP');

        Date.now = () => 10_500;
        AILogic.updateLevel(levelScope);
        assert.equal(player.authoritativeCurrentHp, 7109, 'player regen should wait for the next full second before healing again');

        Date.now = () => 11_000;
        AILogic.updateLevel(levelScope);
        assert.equal(player.authoritativeCurrentHp, 7912, 'second server heartbeat tick should continue healing');

        Date.now = () => 12_000;
        AILogic.updateLevel(levelScope);
        assert.equal(player.authoritativeCurrentHp, 8031, 'subsequent heartbeat ticks should carry the player to full HP');
    } finally {
        Date.now = originalDateNow;
    }
}

function testDeadPlayerDoesNotRegen(): void {
    resetState();

    const player = createFakeClient(5, 'Epsilon', 11);
    player.character!.level = 2;
    player.authoritativeMaxHp = 8031;
    player.authoritativeCurrentHp = 6306;
    player.lastCombatActivityAt = 4_000;

    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.hp = 6306;
    playerEntity.maxHp = 8031;
    playerEntity.dead = true;
    playerEntity.entState = EntityState.DEAD;

    const levelScope = getClientLevelScope(player as never);
    GlobalState.sessionsByToken.set(player.token, player as never);

    const originalDateNow = Date.now;
    try {
        Date.now = () => 10_000;
        AILogic.updateLevel(levelScope);
    } finally {
        Date.now = originalDateNow;
    }

    assert.equal(player.authoritativeCurrentHp, 6306, 'dead players should not regenerate until they revive');
    assert.equal(player.sentPackets.length, 0, 'dead players should not receive regen packets');
}

function testStaleHundredHpSnapshotDoesNotShrinkPlayerRegen(): void {
    resetState();

    const nowMs = 10_000;
    const player = createFakeClient(6, 'Zeta', 13);
    player.character!.level = 2;
    player.authoritativeMaxHp = 100;
    player.authoritativeCurrentHp = 41;
    player.lastCombatActivityAt = nowMs - 6000;

    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.hp = 41;
    playerEntity.maxHp = 100;

    const levelScope = getClientLevelScope(player as never);
    GlobalState.sessionsByToken.set(player.token, player as never);

    CombatHandler.processOutOfCombatRegen(levelScope, nowMs);

    const regenPacket = player.sentPackets.find((packet) => packet.id === 0x3B);
    assert.ok(regenPacket, 'stale player snapshot should still emit a regen packet');
    assert.deepEqual(parseRegenPacket(regenPacket!.payload), {
        entityId: player.clientEntID,
        amount: 803
    });
}

function testDirtyCombatStatsBlockRegenUntilFreshSync(): void {
    resetState();

    const player = createFakeClient(7, 'Eta', 15);
    player.character!.level = 2;
    player.authoritativeMaxHp = 8031;
    player.authoritativeCurrentHp = 6306;
    player.combatStatsDirty = true;
    player.lastCombatStatsRefreshRequestAt = 8_500;
    player.lastCombatActivityAt = 4_000;

    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.hp = 6306;
    playerEntity.maxHp = 8031;

    const levelScope = getClientLevelScope(player as never);
    GlobalState.sessionsByToken.set(player.token, player as never);

    const originalDateNow = Date.now;
    try {
        Date.now = () => 10_000;
        AILogic.updateLevel(levelScope);
        assert.equal(
            player.sentPackets.some((packet) => packet.id === 0x3B),
            false,
            'dirty combat stats should block regen until fresh stats arrive'
        );
        assert.equal(
            player.sentPackets.some((packet) => packet.id === 0xFB),
            true,
            'dirty combat stats should trigger a combat stat refresh request'
        );

        CommandHandler.handleSendCombatStats(player as never, buildCombatStatsPayload(123, 234, 7200, 3, 12));
        player.sentPackets.length = 0;

        Date.now = () => 11_000;
        AILogic.updateLevel(levelScope);
        const regenPacket = player.sentPackets.find((packet) => packet.id === 0x3B);
        assert.ok(regenPacket, 'regen should resume after fresh combat stats arrive');
        assert.deepEqual(parseRegenPacket(regenPacket!.payload), {
            entityId: player.clientEntID,
            amount: 894
        });
    } finally {
        Date.now = originalDateNow;
    }
}

function testIdleWindowBlocksRegen(): void {
    resetState();

    const nowMs = 10_000;
    const player = createFakeClient(2, 'Beta', 5);
    player.authoritativeCurrentHp = 600;
    player.lastCombatActivityAt = nowMs - 5750;

    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.hp = 600;
    playerEntity.maxHp = 1000;

    const levelScope = getClientLevelScope(player as never);
    GlobalState.sessionsByToken.set(player.token, player as never);

    CombatHandler.processOutOfCombatRegen(levelScope, nowMs);

    assert.equal(player.authoritativeCurrentHp, 600, 'regen should not start before the first 1000ms tick is due');
    assert.equal(player.sentPackets.length, 0, 'no regen packet should be emitted before the idle timer matures');
}

function testDeadPlayerArmsBossRegenImmediately(): void {
    resetState();

    const nowMs = 10_000;
    const player = createFakeClient(8, 'Theta', 17);
    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.dead = true;
    playerEntity.entState = EntityState.DEAD;

    const bossId = 900008;
    const boss = {
        id: bossId,
        name: 'GoblinBoss2',
        isPlayer: false,
        clientSpawned: true,
        team: 2,
        entRank: 'Boss',
        roomId: player.currentRoomId,
        entState: EntityState.ACTIVE,
        dead: false,
        hp: 400,
        maxHp: 1000,
        lastCombatActivityAt: nowMs - 100,
        lastCombatRegenTickAt: 0
    };

    const levelScope = getClientLevelScope(player as never);
    GlobalState.levelEntities.get(levelScope)!.set(bossId, boss);
    GlobalState.sessionsByToken.set(player.token, player as never);

    const request = new BitBuffer(false);
    request.writeMethod15(false);
    void CombatHandler.handleRequestRespawn(player as never, request.toBuffer());

    assert.equal(boss.hp, 410, 'boss should receive the first regen tick as soon as player death is processed');
    assert.equal(player.enemyDeathRegenArmed, true, 'death regen should be armed until the player respawns');

    const bossRegenPackets = player.sentPackets
        .filter((packet) => packet.id === 0x3B)
        .map((packet) => parseRegenPacket(packet.payload))
        .filter((packet) => packet.entityId === bossId);
    assert.deepEqual(bossRegenPackets, [{ entityId: bossId, amount: 10 }]);
}

async function testRespawnDoesNotFullHealBoss(): Promise<void> {
    resetState();

    const player = createFakeClient(9, 'Iota', 19);
    attachPlayerEntity(player);
    const playerEntity = player.entities.get(player.clientEntID)!;
    playerEntity.dead = true;
    playerEntity.entState = EntityState.DEAD;

    const bossId = 900009;
    const boss = {
        id: bossId,
        name: 'GoblinBoss2',
        isPlayer: false,
        clientSpawned: true,
        team: 2,
        entRank: 'Boss',
        roomId: player.currentRoomId,
        entState: EntityState.ACTIVE,
        dead: false,
        hp: 400,
        maxHp: 1000,
        lastCombatActivityAt: 0,
        lastCombatRegenTickAt: 0
    };

    const levelScope = getClientLevelScope(player as never);
    GlobalState.levelEntities.get(levelScope)!.set(bossId, boss);
    GlobalState.sessionsByToken.set(player.token, player as never);

    const request = new BitBuffer(false);
    request.writeMethod15(false);
    await CombatHandler.handleRequestRespawn(player as never, request.toBuffer());

    assert.equal(boss.hp, 410, 'respawn should only apply the first slow boss regen tick');
    const oversizedEnemyHeals = player.sentPackets
        .filter((packet) => packet.id === 0x3B)
        .map((packet) => parseRegenPacket(packet.payload))
        .filter((packet) => packet.entityId === bossId && packet.amount > 1000);
    assert.deepEqual(oversizedEnemyHeals, [], 'respawn should not send a full-bar enemy heal packet');
}

async function run(): Promise<void> {
    testPlayerRegenAfterIdleDoesNotHealLivingPlayerBoss();
    testPlayerRegenUsesEntityHealEncoding();
    testAiHeartbeatContinuesPlayerRegenUntilFull();
    testDeadPlayerDoesNotRegen();
    testStaleHundredHpSnapshotDoesNotShrinkPlayerRegen();
    testDirtyCombatStatsBlockRegenUntilFreshSync();
    testIdleWindowBlocksRegen();
    testDeadPlayerArmsBossRegenImmediately();
    await testRespawnDoesNotFullHealBoss();
    console.log('combat_regen_regression: ok');
}

void run();
