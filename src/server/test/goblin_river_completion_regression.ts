import { strict as assert } from 'assert';
import * as path from 'path';
import { GlobalState } from '../core/GlobalState';
import { GameData } from '../core/GameData';
import { LevelConfig } from '../core/LevelConfig';
import { NpcLoader } from '../data/NpcLoader';
import { MissionLoader } from '../data/MissionLoader';
import { MissionID } from '../data/runtime';
import { MissionHandler } from '../handlers/MissionHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

type SentPacket = {
    id: number;
    payload: Buffer;
};

type FakeClient = {
    token: number;
    userId: number | null;
    playerSpawned: boolean;
    currentLevel: string;
    levelInstanceId: string;
    currentRoomId: number;
    clientEntID: number;
    forcedDungeonCompletionScope: string;
    character: {
        name: string;
        level: number;
        xp?: number;
        gold?: number;
        CurrentLevel: { name: string; x: number; y: number };
        PreviousLevel: { name: string; x: number; y: number };
        missions: Record<string, { state: number; currCount?: number; claimed?: number; complete?: number }>;
        questTrackerState: number;
    };
    characters: any[];
    entities: Map<number, any>;
    dungeonRun: any;
    sentPackets: SentPacket[];
    send: (id: number, payload: Buffer) => void;
    sendBitBuffer: (id: number, bb: BitBuffer) => void;
};

function ensureDataLoaded(): void {
    const dataDir = path.resolve(__dirname, '../data');
    if (!LevelConfig.has('GoblinRiverDungeon')) {
        LevelConfig.load(dataDir);
    }
    if (!GameData.getEntType('GoblinBoss2')) {
        GameData.load(dataDir);
    }
    if (!MissionLoader.getMissionDef(MissionID.GoblinRiver)) {
        MissionLoader.load(dataDir);
    }
    if (!NpcLoader.getNpcsForLevel('GoblinRiverDungeon').length) {
        NpcLoader.load(dataDir);
    }
}

function createClient(): FakeClient {
    const sentPackets: SentPacket[] = [];
    const character = {
        name: 'GoblinBossTester',
        level: 5,
        xp: 0,
        gold: 0,
        CurrentLevel: { name: 'GoblinRiverDungeon', x: 0, y: 0 },
        PreviousLevel: { name: 'NewbieRoad', x: 12509, y: 2299 },
        missions: {
            [String(MissionID.GoblinRiver)]: {
                state: 1,
                currCount: 0
            }
        },
        questTrackerState: 7
    };

    return {
        token: 9301,
        userId: null,
        playerSpawned: true,
        currentLevel: 'GoblinRiverDungeon',
        levelInstanceId: 'boss-complete',
        currentRoomId: 1,
        clientEntID: 19301,
        forcedDungeonCompletionScope: '',
        character,
        characters: [character],
        entities: new Map<number, any>(),
        dungeonRun: null,
        sentPackets,
        send(id: number, payload: Buffer) {
            sentPackets.push({ id, payload: Buffer.from(payload) });
        },
        sendBitBuffer(id: number, bb: BitBuffer) {
            sentPackets.push({ id, payload: bb.toBuffer() });
        }
    };
}

async function testGoblinRiverBossKillForcesDungeonCompleteScreen(): Promise<void> {
    const client = createClient();
    const levelScope = `${client.currentLevel}#${client.levelInstanceId}`;
    const remainingHostile = {
        id: 6401,
        name: 'GoblinClub',
        isPlayer: false,
        team: 2,
        entState: 0,
        hp: 10,
        clientSpawned: true,
        ownerToken: client.token,
        roomId: 1
    };
    const boss = {
        id: 6402,
        name: 'GoblinBoss2',
        isPlayer: false,
        team: 2,
        entRank: 'Boss',
        entState: 6,
        hp: 0,
        dead: true,
        clientSpawned: true,
        ownerToken: client.token,
        roomId: 1
    };

    GlobalState.sessionsByToken.set(client.token, client as never);
    GlobalState.levelEntities.set(levelScope, new Map<number, any>([
        [remainingHostile.id, { ...remainingHostile }]
    ]));

    await MissionHandler.handleForcedGoblinRiverBossCompletion(client as never, boss);

    assert.equal(
        client.sentPackets.some((packet) => packet.id === 0x87),
        true,
        'killing GoblinBoss2 should force the dungeon completion screen even if the shared tracker still has other hostiles'
    );
    assert.equal(
        Number(client.character.missions[String(MissionID.GoblinRiver)]?.state ?? 0),
        2,
        'forcing Goblin River completion should move Last of the Goblins to ready-to-turn-in'
    );
    assert.equal(
        Number(client.character.questTrackerState ?? 0),
        100,
        'forcing Goblin River completion should push the quest tracker to 100%'
    );
    assert.deepEqual(
        client.character.CurrentLevel,
        client.character.PreviousLevel,
        'forcing Goblin River completion should move the character back to the safe previous level'
    );
}

async function main(): Promise<void> {
    ensureDataLoaded();
    const sessionsByToken = new Map(GlobalState.sessionsByToken);
    const levelEntities = new Map(GlobalState.levelEntities);

    try {
        GlobalState.sessionsByToken.clear();
        GlobalState.levelEntities.clear();
        await testGoblinRiverBossKillForcesDungeonCompleteScreen();
        console.log('goblin_river_completion_regression: ok');
    } finally {
        GlobalState.sessionsByToken = sessionsByToken;
        GlobalState.levelEntities = levelEntities;
    }
}

void main().catch((error) => {
    console.error('goblin_river_completion_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
