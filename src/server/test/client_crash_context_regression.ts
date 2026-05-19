import assert from 'assert/strict';
import type { Client } from '../core/Client';
import { EntityTeam } from '../core/Entity';
import { GlobalState } from '../core/GlobalState';
import { SystemHandler } from '../handlers/SystemHandler';

type CrashContextAccessor = {
    buildCrashContext(client: Client): string;
    decodeCrashMessage(data: Buffer): string;
};

function main(): void {
    GlobalState.levelEntities.clear();

    const nowMs = Date.now();
    const levelScope = 'GoblinRiverDungeon#77';
    const player = {
        id: 100,
        name: 'Tester',
        isPlayer: true,
        team: EntityTeam.PLAYER,
        roomId: 5,
        x: 100,
        y: 50,
        hp: 500,
        maxHp: 600
    };
    const enemy = {
        id: 301,
        name: 'DemonHarrier2',
        isPlayer: false,
        team: EntityTeam.ENEMY,
        roomId: 5,
        x: 130,
        y: 50,
        level: 10,
        hp: 90,
        maxHp: 100,
        clientSpawned: true,
        ownerToken: 999,
        lastCombatActivityAt: nowMs - 1000
    };

    GlobalState.levelEntities.set(levelScope, new Map([
        [player.id, player],
        [enemy.id, enemy]
    ]));

    const client = {
        userId: 10,
        token: 999,
        character: {
            name: 'Tester',
            CurrentLevel: { name: 'GoblinRiverDungeon' }
        },
        currentLevel: 'GoblinRiverDungeon',
        levelInstanceId: '77',
        clientEntID: player.id,
        currentRoomId: 5,
        lastDoorId: 2,
        lastDoorTargetLevel: 'NewbieRoad',
        lastCombatActivityAt: nowMs - 900,
        authoritativeCurrentHp: 500,
        authoritativeMaxHp: 600,
        activeDungeonCutsceneScope: '',
        activeDungeonCutsceneRoomId: 0,
        entities: new Map([[player.id, player]]),
        lastCombatEvent: {
            atMs: nowMs - 800,
            levelScope,
            packet: '0x0A PowerHit',
            sourceId: enemy.id,
            sourceName: enemy.name,
            sourceTeam: enemy.team,
            sourceRoomId: enemy.roomId,
            targetId: player.id,
            targetName: player.name,
            targetTeam: player.team,
            targetRoomId: player.roomId,
            powerId: 2020,
            damage: 123
        }
    } as unknown as Client;

    const systemHandler = SystemHandler as unknown as CrashContextAccessor;
    const encodedMessage = Buffer.concat([
        Buffer.from([0x00, 0x13]),
        Buffer.from('ArgumentError: boom', 'utf8')
    ]);
    const context = systemHandler.buildCrashContext(client);

    assert.equal(systemHandler.decodeCrashMessage(encodedMessage), 'ArgumentError: boom');
    assert.match(context, /Context:/);
    assert.match(context, /lastCombat: 0x0A PowerHit/);
    assert.match(context, /source=DemonHarrier2#301/);
    assert.match(context, /powerId=2020/);
    assert.match(context, /damage=123/);
    assert.match(context, /lastCombatDebug: .*power=PuckMelee1#2020/);
    assert.match(context, /lastCombatDebug: .*sourceSlot=MeleePower/);
    assert.match(context, /lastCombatDebug: .*castAnim=Melee/);
    assert.match(context, /lastCombatDebug: .*sourceArt=Animation_Puck\.swf\/a__Animation,custom=Animation_Puck\.swf\/Demon/);
    assert.match(context, /suspectEnemies:/);
    assert.match(context, /DemonHarrier2#301/);
    assert.match(context, /art=Animation_Puck\.swf\/a__Animation,custom=Animation_Puck\.swf\/Demon/);
    assert.match(context, /powers=melee:PuckMelee1,ranged:PuckShot,extra:PuckMelee2/);
}

try {
    main();
} catch (error) {
    console.error('client_crash_context_regression: failed');
    console.error(error);
    process.exit(1);
}
