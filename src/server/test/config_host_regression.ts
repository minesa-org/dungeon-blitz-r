import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { hasRequiredServerDataDir, normalizeHostValue } from '../core/config';

function testNormalizeHostValue(): void {
    assert.equal(
        normalizeHostValue('http://localhost:8000/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp', 'fallback'),
        'localhost'
    );
    assert.equal(normalizeHostValue('https://10.179.241.65/', 'fallback'), '10.179.241.65');
    assert.equal(normalizeHostValue('10.179.241.65:8000', 'fallback'), '10.179.241.65');
    assert.equal(normalizeHostValue('', 'fallback'), 'fallback');
}

function testServerDataDirRequiresNpcData(): void {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'db-config-data-'));
    const partialRoot = path.join(tempRoot, 'partial');
    const completeRoot = path.join(tempRoot, 'complete');

    try {
        fs.mkdirSync(path.join(partialRoot, 'data'), { recursive: true });
        fs.writeFileSync(path.join(partialRoot, 'data', 'level_config.json'), '{}');

        fs.mkdirSync(path.join(completeRoot, 'data', 'npcs'), { recursive: true });
        for (const fileName of ['level_config.json', 'EntTypes.json', 'MissionTypes.json']) {
            fs.writeFileSync(path.join(completeRoot, 'data', fileName), '{}');
        }

        assert.equal(
            hasRequiredServerDataDir(partialRoot),
            false,
            'compiled partial data should not be selected for multiplayer runtime'
        );
        assert.equal(hasRequiredServerDataDir(completeRoot), true);
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }
}

function main(): void {
    testNormalizeHostValue();
    testServerDataDirRequiresNpcData();
    console.log('config_host_regression: ok');
}

main();
