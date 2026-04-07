import { strict as assert } from 'assert';
import * as path from 'path';
import {
    buildCustomFallbackDungeonStatCaps,
    getDungeonStatCaps,
    getDungeonStatTotalCap
} from '../core/DungeonStatCaps';
import { LevelConfig } from '../core/LevelConfig';

function ensureLevelConfigLoaded(): void {
    if (!LevelConfig.has('GhostBossDungeon')) {
        LevelConfig.load(path.resolve(__dirname, '../data'));
    }
}

function assertTierBackedCaps(levelName: string, resultBar: number): void {
    const caps = getDungeonStatCaps(levelName);
    assert.ok(caps, `${levelName} should have an asset-backed dungeon cap entry`);
    assert.equal(caps!.source, 'original-client-ui-with-inferred-tier');
    assert.equal(caps!.resultBar, resultBar, `${levelName} should keep its inferred original tier`);
    assert.equal(caps!.killCap, 40_000 * resultBar, `${levelName} should use the original kill bucket weight`);
    assert.equal(caps!.accuracyCap, 20_000 * resultBar, `${levelName} should use the original accuracy bucket weight`);
    assert.equal(caps!.deathCap, 20_000 * resultBar, `${levelName} should use the original deaths bucket weight`);
    assert.equal(caps!.treasureCap, 10_000 * resultBar, `${levelName} should use the original treasure bucket weight`);
    assert.equal(caps!.timeBonusCap, 10_000 * resultBar, `${levelName} should use the original time bucket weight`);
    assert.equal(
        getDungeonStatTotalCap(caps!),
        100_000 * resultBar,
        `${levelName} total cap should match the original five-bucket result-screen formula`
    );
}

function testWolfsEndBossCapsUseOriginalUiBuckets(): void {
    assertTierBackedCaps('GhostBossDungeon', 4);
    assertTierBackedCaps('DreamDragonDungeon', 5);
}

function testBlackRoseMireMissionCapsUseTierMappings(): void {
    const expectedBars: Array<[string, number]> = [
        ['SRN_Mission1', 6],
        ['SRN_Mission2', 7],
        ['SRN_Mission3', 8],
        ['SRN_Mission4', 8],
        ['SRN_Mission5', 9],
        ['SRN_Mission6', 8],
        ['SRN_Mission7', 9]
    ];

    for (const [levelName, resultBar] of expectedBars) {
        assertTierBackedCaps(levelName, resultBar);
    }
}

function testUnknownDungeonFallbackStaysExplicit(): void {
    const caps = buildCustomFallbackDungeonStatCaps('CraftTownTutorial');
    assert.equal(caps.source, 'custom-fallback');
    assert.equal(caps.resultBar, 3, 'validated custom benchmark tiers should stay explicit when no asset-backed mapping was proven');
    assert.equal(getDungeonStatCaps('CraftTownTutorial'), null, 'custom fallback entries should not masquerade as asset-backed caps');
}

function main(): void {
    ensureLevelConfigLoaded();
    testWolfsEndBossCapsUseOriginalUiBuckets();
    testBlackRoseMireMissionCapsUseTierMappings();
    testUnknownDungeonFallbackStaysExplicit();
    console.log('dungeon_stat_caps_regression: ok');
}

try {
    main();
} catch (error) {
    console.error('dungeon_stat_caps_regression: failed');
    console.error(error);
    process.exitCode = 1;
}
