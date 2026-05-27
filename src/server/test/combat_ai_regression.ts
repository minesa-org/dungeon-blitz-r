import { strict as assert } from 'assert';
import { AILogic } from '../core/AILogic';

type FakeClient = {
    currentRoomId: number;
    character: {
        CurrentLevel: { x: number; y: number };
    };
};

function createPlayer(x: number, y: number, roomId: number): FakeClient {
    return {
        currentRoomId: roomId,
        character: {
            CurrentLevel: { x, y }
        }
    };
}

function createNpc(overrides: Record<string, unknown>): any {
    return {
        id: 2001,
        name: 'GoblinDagger',
        team: 2,
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        roomId: 1,
        ...overrides
    };
}

function testNormalMeleeAggroStillUsesLocalRoomRadius(): void {
    const npc = createNpc({});

    AILogic.updateNpc(npc, [createPlayer(220, 0, 1) as never], 'BridgeTown');

    assert.equal(
        npc.x > 0,
        true,
        'normal melee enemies should still aggro a nearby player in the same room'
    );
}

function testBossAggroUsesShorterRadius(): void {
    const npc = createNpc({
        name: 'TestBoss',
        entRank: 'Boss'
    });

    AILogic.updateNpc(npc, [createPlayer(220, 0, 1) as never], 'BridgeTown');

    assert.equal(
        npc.x,
        0,
        'boss-like enemies should not aggro at the old broad melee radius'
    );
}

function testBossAggroRequiresKnownSameRoom(): void {
    const npc = createNpc({
        name: 'TestBoss',
        entRank: 'Boss',
        roomId: -1
    });

    AILogic.updateNpc(npc, [createPlayer(30, 0, -1) as never], 'BridgeTown');

    assert.equal(
        npc.x,
        0,
        'boss-like enemies should not aggro when either side lacks a known matching room'
    );
}

function main(): void {
    testNormalMeleeAggroStillUsesLocalRoomRadius();
    testBossAggroUsesShorterRadius();
    testBossAggroRequiresKnownSameRoom();
    console.log('combat_ai_regression: ok');
}

try {
    main();
} catch (error) {
    console.error('combat_ai_regression: failed');
    console.error(error);
    process.exitCode = 1;
}
