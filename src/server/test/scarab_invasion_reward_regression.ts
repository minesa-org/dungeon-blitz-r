import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { MissionLoader } from '../data/MissionLoader';
import { MissionID } from '../data/runtime/MissionID';

function resolveDataDir(): string {
    const candidates = [
        path.resolve(__dirname, '..', 'data'),
        path.resolve(__dirname, '..', '..', 'data'),
        path.resolve(process.cwd(), 'src/server/data')
    ];
    return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'MissionTypes.json'))) ?? candidates[0];
}

function main(): void {
    MissionLoader.load(resolveDataDir());

    const missionDef = MissionLoader.getMissionDef(MissionID.ScarabInvasion);
    assert.ok(missionDef, 'Scarab Invasion mission definition must load');
    assert.equal(missionDef.ExpRewardValue, 1747, 'Scarab Invasion must award 1747 XP');
    assert.equal(missionDef.GoldRewardValue, 1416, 'Scarab Invasion must award 1416 gold');

    console.log('scarab_invasion_reward_regression: ok');
}

main();
