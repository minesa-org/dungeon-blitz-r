import { strict as assert } from 'assert';
import { DebugLogger } from '../core/Debug';
import { GlobalState } from '../core/GlobalState';
import { BitBuffer } from '../network/protocol/bitBuffer';
import { SystemHandler } from '../handlers/SystemHandler';

function formatClient(client: Record<string, unknown>): string {
    return (DebugLogger as any).formatClient(client);
}

function testPendingDebugLevelOverridesStaleCurrentLevelBeforeSpawn(): void {
    const line = formatClient({
        userId: 10,
        token: 0,
        pendingDebugLevel: 'JadeCity',
        currentLevel: 'NewbieRoad',
        playerSpawned: false,
        clientEntID: 0,
        character: {
            name: 'Telahair',
            CurrentLevel: { name: 'JadeCity', x: 10430, y: 1058 }
        }
    });

    assert.ok(line.includes('level=JadeCity'), line);
}

function testUnspawnedDebugUsesCharacterTargetWhenCurrentLevelIsStale(): void {
    const line = formatClient({
        userId: 10,
        token: 0,
        pendingDebugLevel: '',
        currentLevel: 'NewbieRoad',
        playerSpawned: false,
        clientEntID: 0,
        character: {
            name: 'Telahair',
            CurrentLevel: { name: 'JadeCity', x: 10430, y: 1058 }
        }
    });

    assert.ok(line.includes('level=JadeCity'), line);
}

function testSpawnedDebugKeepsActiveSessionLevel(): void {
    const line = formatClient({
        userId: 10,
        token: 27635,
        pendingDebugLevel: '',
        currentLevel: 'JC_Mission2',
        playerSpawned: true,
        clientEntID: 27635,
        character: {
            name: 'Telahair',
            CurrentLevel: { name: 'JadeCity', x: 10430, y: 1058 }
        }
    });

    assert.ok(line.includes('level=JC_Mission2'), line);
}

function testClientCrashContextUsesReadableEnemyTerms(): void {
    const player = {
        id: 35180,
        name: 'Telahair',
        isPlayer: true,
        team: 1,
        roomId: 0,
        x: 5951,
        y: 799,
        hp: 100,
        maxHp: 100,
        ownerToken: 35180
    };
    const enemy = {
        id: 3115372,
        name: 'RatlingMace',
        isPlayer: false,
        team: 2,
        roomId: 0,
        x: 6228,
        y: 799,
        clientSpawned: true,
        ownerToken: 35180
    };
    const client = {
        userId: 10,
        token: 35180,
        character: {
            name: 'Telahair',
            CurrentLevel: { name: 'JadeCity', x: 5951, y: 799 }
        },
        currentLevel: 'JadeCity',
        levelInstanceId: '',
        currentRoomId: 0,
        clientEntID: 35180,
        entities: new Map<number, any>([
            [35180, player],
            [3115372, enemy]
        ]),
        lastDoorId: -1,
        lastDoorTargetLevel: '',
        authoritativeCurrentHp: 100,
        authoritativeMaxHp: 100,
        lastCombatActivityAt: 0,
        lastCombatEvent: null,
        activeDungeonCutsceneScope: '',
        activeDungeonCutsceneRoomId: 0
    };

    const previousScope = GlobalState.levelEntities.get('JadeCity');
    try {
        GlobalState.levelEntities.set('JadeCity', new Map<number, any>([[3115372, enemy]]));

        const context = SystemHandler.buildCrashContext(client as any);

        assert.ok(context.includes('Context:'), context);
        assert.ok(context.includes('session: userId=10 token=35180 char=Telahair level=JadeCity'), context);
        assert.ok(context.includes('lastDoor: id=(none) target=(none)'), context);
        assert.ok(context.includes('combat: lastActivityAgeMs=(none) hp=100/100'), context);
        assert.ok(context.includes('player: Telahair#35180 team=1 room=0'), context);
        assert.ok(context.includes('suspectEnemies:'), context);
        assert.ok(context.includes('RatlingMace#3115372 team=2 room=0'), context);
        assert.ok(context.includes('flags=clientSpawned,ownerToken=35180'), context);
        assert.ok(context.includes('art=Animation_Goblin.swf/a__Animation'), context);
        assert.ok(context.includes('powers=melee:GoblinMeleeS'), context);
    } finally {
        if (previousScope) {
            GlobalState.levelEntities.set('JadeCity', previousScope);
        } else {
            GlobalState.levelEntities.delete('JadeCity');
        }
    }
}

function testPacketDebugIncludesResolvedEnemyName(): void {
    const entityId = 123456;
    const bb = new BitBuffer(false);
    bb.writeMethod4(entityId);
    bb.writeMethod45(0);
    bb.writeMethod45(0);
    bb.writeMethod45(0);
    bb.writeMethod6(0, 2);
    bb.writeMethod15(false);
    bb.writeMethod15(false);
    bb.writeMethod15(false);
    bb.writeMethod15(false);
    bb.writeMethod15(false);
    bb.writeMethod15(false);

    const client = {
        currentLevel: 'JC_Mission2',
        character: {
            name: 'Telahair',
            CurrentLevel: { name: 'JC_Mission2' }
        },
        entities: new Map<number, any>([
            [entityId, {
                id: entityId,
                name: 'GreaterBoneGolem2',
                team: 2,
                roomId: 0,
                hp: 500,
                maxHp: 500
            }]
        ])
    };

    const refs = (DebugLogger as any).formatPacketEntityRefs(client, 0x07, bb.toBuffer());

    assert.ok(refs.includes('Mortis Golem#123456'), refs);
    assert.ok(refs.includes('type=GreaterBoneGolem2'), refs);
    assert.ok(refs.includes('team=2'), refs);
    assert.ok(refs.includes('hp=500/500'), refs);
}

function main(): void {
    testPendingDebugLevelOverridesStaleCurrentLevelBeforeSpawn();
    testUnspawnedDebugUsesCharacterTargetWhenCurrentLevelIsStale();
    testSpawnedDebugKeepsActiveSessionLevel();
    testClientCrashContextUsesReadableEnemyTerms();
    testPacketDebugIncludesResolvedEnemyName();
    console.log('debug_logger_regression: ok');
}

main();
