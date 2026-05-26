import { GameData } from './core/GameData';
import { LevelConfig } from './core/LevelConfig';
import { MissionLoader } from './data/MissionLoader';

const dataDir = __dirname + '/data';
LevelConfig.load(dataDir);
MissionLoader.load(dataDir);
GameData.load(dataDir);

const e:any = {name:'ScarabScorpion'};
console.log('rank', GameData.getEntityRank(e));
console.log('isBossEntity', GameData.isBossEntity(e));
console.log('entType', GameData.getEntType('ScarabScorpion'));
