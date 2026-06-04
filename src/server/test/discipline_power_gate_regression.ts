import { strict as assert } from 'assert';
import { EntityState, EntityTeam } from '../core/Entity';
import { GlobalState } from '../core/GlobalState';
import { getClientLevelScope } from '../core/LevelScope';
import { CombatHandler } from '../handlers/CombatHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    userId: number;
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    playerSpawned: boolean;
    clientEntID: number;
    character: any;
    characters: any[];
    entities: Map<number, any>;
    sentPackets: SentPacket[];
    send(id: number, payload: Buffer): void;
    sendBitBuffer(id: number, payload: BitBuffer): void;
};

function createMageClient(activeAbilities: number[] = [10, 14, 17]): FakeClient {
    const sentPackets: SentPacket[] = [];
    return {
        token: 8801,
        userId: 8801,
        currentLevel: 'CraftTown',
        levelInstanceId: '',
        currentRoomId: 1,
        playerSpawned: true,
        clientEntID: 48801,
        character: {
            name: 'DiscPowerGate',
            class: 'Mage',
            MasterClass: 7,
            activeAbilities,
            learnedAbilities: [
                { abilityID: 10, rank: 10 },
                { abilityID: 14, rank: 10 },
                { abilityID: 17, rank: 10 },
                { abilityID: 66, rank: 10 },
                { abilityID: 98, rank: 10 }
            ]
        },
        characters: [],
        entities: new Map<number, any>(),
        sentPackets,
        send(id: number, payload: Buffer): void {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, payload: BitBuffer): void {
            sentPackets.push({ id, payload: payload.toBuffer() });
        }
    };
}

function buildPowerHitPacket(targetId: number, sourceId: number, damage: number, powerId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(targetId);
    bb.writeMethod4(sourceId);
    bb.writeMethod24(damage);
    bb.writeMethod4(powerId);
    bb.writeMethod15(false);
    bb.writeMethod15(false);
    bb.writeMethod15(false);
    return bb.toBuffer();
}

async function withCombatFixture(client: FakeClient, fn: (targetEntity: any) => Promise<void>): Promise<void> {
    const sessionsByToken = GlobalState.sessionsByToken;
    const levelEntities = GlobalState.levelEntities;
    const combatContributions = GlobalState.combatContributions;
    const levelScope = getClientLevelScope(client as never);
    const targetId = 61101;
    const playerEntity = {
        id: client.clientEntID,
        name: client.character.name,
        isPlayer: true,
        team: EntityTeam.PLAYER,
        entState: EntityState.ACTIVE
    };
    const targetEntity = {
        id: targetId,
        name: 'TrainingTarget',
        isPlayer: false,
        team: EntityTeam.ENEMY,
        hp: 100,
        maxHp: 100,
        entState: EntityState.ACTIVE,
        dead: false
    };

    GlobalState.sessionsByToken = new Map([[client.token, client as never]]);
    GlobalState.levelEntities = new Map([
        [levelScope, new Map<number, any>([
            [playerEntity.id, playerEntity],
            [targetEntity.id, targetEntity]
        ])]
    ]);
    GlobalState.combatContributions = new Map();
    client.entities.set(playerEntity.id, playerEntity);
    client.entities.set(targetEntity.id, targetEntity);

    try {
        await fn(targetEntity);
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
        GlobalState.combatContributions = combatContributions;
    }
}

async function testSelectedSameBaseDisciplinePowerHitIsAllowed(): Promise<void> {
    const client = createMageClient([98, 14, 17]);
    await withCombatFixture(client, async (targetEntity) => {
        await CombatHandler.handlePowerHit(
            client as never,
            buildPowerHitPacket(targetEntity.id, client.clientEntID, 25, 5901)
        );
        assert.equal(targetEntity.hp, 75, 'selected same-base Necromancer power hits should apply damage');
    });
}

async function testUnselectedHotbarDisciplinePowerHitIsRejected(): Promise<void> {
    const client = createMageClient([10, 14, 17]);
    await withCombatFixture(client, async (targetEntity) => {
        await CombatHandler.handlePowerHit(
            client as never,
            buildPowerHitPacket(targetEntity.id, client.clientEntID, 25, 5901)
        );
        assert.equal(targetEntity.hp, 100, 'unselected hotbar discipline power hits must not apply damage');
    });
}

async function testSameBaseMasterDisciplinePowerHitIsAllowed(): Promise<void> {
    const client = createMageClient([10, 14, 17]);
    await withCombatFixture(client, async (targetEntity) => {
        await CombatHandler.handlePowerHit(
            client as never,
            buildPowerHitPacket(targetEntity.id, client.clientEntID, 25, 820)
        );
        assert.equal(targetEntity.hp, 75, 'same-base Flameseer master ability power hits should apply damage');
    });
}

async function testActiveBaseClassPowerHitIsStillAllowed(): Promise<void> {
    const client = createMageClient([10, 14, 17]);
    await withCombatFixture(client, async (targetEntity) => {
        await CombatHandler.handlePowerHit(
            client as never,
            buildPowerHitPacket(targetEntity.id, client.clientEntID, 13, 500)
        );
        assert.equal(targetEntity.hp, 87, 'active Mage Fire Blast power hits should still apply damage');
    });
}

async function main(): Promise<void> {
    await testSelectedSameBaseDisciplinePowerHitIsAllowed();
    await testUnselectedHotbarDisciplinePowerHitIsRejected();
    await testSameBaseMasterDisciplinePowerHitIsAllowed();
    await testActiveBaseClassPowerHitIsStillAllowed();
    console.log('discipline_power_gate_regression: ok');
}

void main().catch((error) => {
    console.error('discipline_power_gate_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
