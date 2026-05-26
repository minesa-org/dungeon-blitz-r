import { LevelConfig } from './core/LevelConfig';
import { MissionLoader } from './data/MissionLoader';
import { GameData } from './core/GameData';
import { MissionID } from './data/runtime';
import { CombatHandler } from './handlers/CombatHandler';
import { MissionHandler } from './handlers/MissionHandler';
import { GlobalState } from './core/GlobalState';
import { BitBuffer } from './network/protocol/bitBuffer';

function ensureDataLoaded(): void {
    const dataDir = __dirname + '/data';
    if (!LevelConfig.has('NewbieRoad')) {
        LevelConfig.load(dataDir);
    }
    if (!MissionLoader.getMissionDef(MissionID.GetGoblinNoserings)) {
        MissionLoader.load(dataDir);
    }
    if (!GameData.getEntType('Devourer')) {
        GameData.load(dataDir);
    }
}

const client: any = {
    token: 9101,
    currentLevel: 'ShazariDesert',
    levelInstanceId: '',
    currentRoomId: 0,
    playerSpawned: true,
    clientEntID: 40101,
    userId: null,
    character: { name: 't', class: 'Paladin', gender: 'male', level: 3, missions: { [String(MissionID.GatherScorpionStingers)]: { state: 1, currCount: 8 } }, questTrackerState: 100, CurrentLevel: { name: 'ShazariDesert', x: 0, y: 0 }, PreviousLevel: { name: 'ShazariDesert', x: 0, y: 0 } },
    characters: [] as any[],
    authoritativeMaxHp: 100,
    authoritativeCurrentHp: 100,
    processedRewardSources: new Set<string>(),
    pendingLoot: new Map<number, unknown>(),
    knownEntityIds: new Set<number>(),
    entities: new Map<number, any>(),
    send() {},
    sendBitBuffer() {}
};
client.characters = [client.character];

const orig = MissionHandler.handleEnemyDefeatMissionProgress;
(MissionHandler as any).handleEnemyDefeatMissionProgress = (c: any, ent: any) => {
    console.log('missionProgress called', ent?.name);
    return orig(c as never, ent as never);
};

function reset() {
    GlobalState.sessionsByToken.clear();
    GlobalState.sessionsByUserId.clear();
    GlobalState.sessionsByCharacterName.clear();
    GlobalState.partyGroups.clear();
    GlobalState.partyByMember.clear();
    GlobalState.levelEntities.clear();
    GlobalState.levelQuestProgress.clear();
    GlobalState.combatContributions.clear();
    GlobalState.entityLifeNonces.clear();
    GlobalState.entityLastRewardNonces.clear();
}

function destroyPacket(entityId: number): Buffer {
    const bb = new BitBuffer(false);
    bb.writeMethod4(entityId);
    bb.writeMethod15(false);
    return bb.toBuffer();
}

async function kill(id: number, name: string) {
    client.entities.set(id, { id, name, isPlayer: false, team: 2 });
    await CombatHandler.handleEntityDestroy(client as never, destroyPacket(id));
}

(async () => {
    ensureDataLoaded();
    reset();
    console.log('before', JSON.stringify(client.character.missions[String(MissionID.GatherScorpionStingers)]));
    await kill(8471, 'ScarabPredator');
    console.log('after1', JSON.stringify(client.character.missions[String(MissionID.GatherScorpionStingers)]));
    await kill(8472, 'ScarabScorpion');
    console.log('after2', JSON.stringify(client.character.missions[String(MissionID.GatherScorpionStingers)]));
})();
