// @ts-nocheck
import path from 'path';
import { Character } from '../../database/Database';
import { LevelConfig } from '../../core/LevelConfig';
import { MissionLoader } from '../../data/MissionLoader';
import { GameData } from '../../core/GameData';
import { MissionID } from '../../data/runtime';
import { CombatHandler } from '../../handlers/CombatHandler';
import { GlobalState } from '../../core/GlobalState';
import { BitBuffer } from '../../network/protocol/bitBuffer';
import { BitReader } from '../../network/protocol/bitReader';
import { EntityHandler } from '../../handlers/EntityHandler';

function ensureDataLoaded() {
  const dataDir = path.resolve(__dirname, '../../data');
  if (!LevelConfig.has('NewbieRoad')) LevelConfig.load(dataDir);
  if (!MissionLoader.getMissionDef(MissionID.GetGoblinNoserings)) MissionLoader.load(dataDir);
  if (!GameData.getEntType('Devourer')) GameData.load(dataDir);
}
function reset(){
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

const createClient = () => {
  const c: Character = { name:'t', class:'Paladin', gender:'male', level:3, missions:{ [String(MissionID.GatherScorpionStingers)]: {state:1,currCount:8} }, questTrackerState:100, CurrentLevel:{name:'ShazariDesert',x:0,y:0}, PreviousLevel:{name:'ShazariDesert',x:0,y:0} };
  return {token:9101,currentLevel:'ShazariDesert',levelInstanceId:'',currentRoomId:0,playerSpawned:true,clientEntID:40101,userId:null,character:c,characters:[c],authoritativeMaxHp:100,authoritativeCurrentHp:100,processedRewardSources:new Set(),pendingLoot:new Map(),knownEntityIds:new Set(),entities:new Map(),send() {},sendBitBuffer() {}} as any;
};

const destroyPacket = (entityId:number) => { const bb = new BitBuffer(false); bb.writeMethod4(entityId); bb.writeMethod15(false); return bb.toBuffer(); }

const handlerAny: any = CombatHandler;
const origED = handlerAny.handleEntityDestroy;
handlerAny.handleEntityDestroy = async function(client: any, data: Buffer){
  const raw = EntityHandler.resolveEntityAlias(client, new BitReader(data).readMethod9());
  console.log('[handleEntityDestroy-hf]', { raw, keys:[...client.entities.keys()] });
  return origED.call(CombatHandler, client, data);
};

const origState = handlerAny.handleEnemyDefeatState;
handlerAny.handleEnemyDefeatState = function(client:any, scope:string,id:number, entity:any, opts:any){
  console.log('[handleEnemyDefeatState-hf]', {scope,id,name:entity?.name,team:entity?.team,opts});
  return origState.call(CombatHandler, client, scope, id, entity, opts);
};

(async()=>{
  ensureDataLoaded(); reset();
  const client = createClient();
  for (const [id,name] of [[8471,'ScarabPredator'],[8472,'ScarabScorpion']] as [number,string][]) {
    client.entities.set(id,{id,name,isPlayer:false,team:2});
    await handlerAny.handleEntityDestroy(client, destroyPacket(id));
  }
})();
