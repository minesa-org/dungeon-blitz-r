import { Character } from './database/Database';
import { LevelConfig } from './core/LevelConfig';
import { MissionLoader } from './data/MissionLoader';
import { GameData } from './core/GameData';
import { MissionID } from './data/runtime';
import { CombatHandler } from './handlers/CombatHandler';
import { GlobalState } from './core/GlobalState';
import { BitBuffer } from './network/protocol/bitBuffer';

function ensureDataLoaded(): void {
    const dataDir = __dirname.replace(/\/src\/server$/, '') + '/data';
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

function reset(): void {
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

interface FakeClient {
  token:number; currentLevel:string; levelInstanceId:string; currentRoomId:number; playerSpawned:boolean; clientEntID:number; userId:number|null;
  character: Character; characters: Character[]; authoritativeMaxHp:number; authoritativeCurrentHp:number;
  processedRewardSources:Set<string>; pendingLoot:Map<number,unknown>; knownEntityIds:Set<number>; entities: Map<number, any>;
  send:(id:number,payload:Buffer)=>void; sendBitBuffer:(id:number,bb:any)=>void;
}

function createClient(currentLevel='ShazariDesert') {
  const c: Character = {
    name:'t', class:'Paladin', gender:'male', level:3,
    missions: { [String(MissionID.GatherScorpionStingers)]: { state: 1, currCount: 8 } },
    questTrackerState: 100,
    CurrentLevel: { name: currentLevel, x: 0, y: 0 },
    PreviousLevel: { name: currentLevel, x: 0, y: 0 }
  };

  return {
    token: 9101,
    currentLevel,
    levelInstanceId: '',
    currentRoomId: 0,
    playerSpawned: true,
    clientEntID: 40101,
    userId: null,
    character: c,
    characters: [c],
    authoritativeMaxHp: 100,
    authoritativeCurrentHp: 100,
    processedRewardSources: new Set(),
    pendingLoot: new Map(),
    knownEntityIds: new Set(),
    entities: new Map(),
    send() {},
    sendBitBuffer() {}
  } as FakeClient;
}

function destroyPacket(entityId:number):Buffer{ const bb = new BitBuffer(false); bb.writeMethod4(entityId); bb.writeMethod15(false); return bb.toBuffer(); }

async function destroyEnemy(client: FakeClient,id:number,name:string){
  client.entities.set(id,{id,name,isPlayer:false,team:2});
  await CombatHandler.handleEntityDestroy(client as never, destroyPacket(id));
}

(async()=>{
  ensureDataLoaded();
  reset();
  const client = createClient();
  await destroyEnemy(client,8471,'ScarabPredator');
  console.log('after1', client.character.missions[String(MissionID.GatherScorpionStingers)]);
  await destroyEnemy(client,8472,'ScarabScorpion');
  console.log('after2', client.character.missions[String(MissionID.GatherScorpionStingers)]);
})();
