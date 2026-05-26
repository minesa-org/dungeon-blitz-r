import { LevelConfig } from './core/LevelConfig';

const dataDir = __dirname + '/data';
if (!LevelConfig.has('NewbieRoad')) LevelConfig.load(dataDir);
console.log('is dungeon', LevelConfig.isDungeonLevel('ShazariDesert'));
console.log('normalize', LevelConfig.normalizeLevelName('ShazariDesert'));
