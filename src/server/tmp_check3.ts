import { GameData } from './core/GameData';
import { LevelConfig } from './core/LevelConfig';
import { MissionLoader } from './data/MissionLoader';
import { MissionHandler } from './handlers/MissionHandler';

const dataDir = __dirname + '/data';
LevelConfig.load(dataDir);
MissionLoader.load(dataDir);
GameData.load(dataDir);

const pred: any = {name:'ScarabPredator'};
const scorp: any = {name:'ScarabScorpion'};
const lvl='ShazariDesert';
console.log('pred boss', GameData.getEntityRank(pred), GameData.isBossEntity(pred));
console.log('scorp boss', GameData.getEntityRank(scorp), GameData.isBossEntity(scorp));
console.log('requiredCompBoss pred', (MissionHandler as any).isRequiredDungeonCompletionBossEntity(lvl, pred));
console.log('requiredCompBoss scorp', (MissionHandler as any).isRequiredDungeonCompletionBossEntity(lvl, scorp));
console.log('ignore pred', (MissionHandler as any).shouldIgnoreUnverifiedDungeonBossDefeat(lvl, pred));
console.log('ignore scorp', (MissionHandler as any).shouldIgnoreUnverifiedDungeonBossDefeat(lvl, scorp));
