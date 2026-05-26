import { LevelConfig } from './core/LevelConfig';
import { MissionLoader } from './data/MissionLoader';
import { GameData } from './core/GameData';
import { MissionHandler } from './handlers/MissionHandler';

const dataDir = __dirname + '/data';
if (!LevelConfig.has('NewbieRoad')) LevelConfig.load(dataDir);
if (!MissionLoader.getMissionDef(1)) MissionLoader.load(dataDir);
if (!GameData.getEntType('Devourer')) GameData.load(dataDir);

const pred = (MissionHandler as any).shouldIgnoreUnverifiedDungeonBossDefeat('ShazariDesert', { name: 'ScarabPredator', isPlayer: false, team: 2 });
const sc = (MissionHandler as any).shouldIgnoreUnverifiedDungeonBossDefeat('ShazariDesert', { name: 'ScarabScorpion', isPlayer: false, team: 2 });
console.log('pred', pred, 'scorpion', sc);
