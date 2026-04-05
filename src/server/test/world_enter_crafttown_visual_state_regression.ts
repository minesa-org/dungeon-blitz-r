import { strict as assert } from 'assert';
import { BitReader } from '../network/protocol/bitReader';
import { WorldEnter } from '../utils/WorldEnter';

function createCharacter(): any {
    return {
        name: 'Alpha',
        class: 'paladin',
        gender: 'male',
        MasterClass: 0,
        magicForge: {
            stats_by_building: {
                '1': 4,
                '2': 3,
                '12': 5,
                '13': 2
            }
        },
        buildingUpgrade: {
            buildingID: 12,
            rank: 4,
            ReadyTime: 999999999
        }
    };
}

function decodeCraftTownVisualData(packet: Buffer) {
    const br = new BitReader(packet);

    br.readMethod4();
    br.readMethod4();
    br.readMethod13();

    const hasOldCoord = br.readMethod20(1) === 1;
    if (hasOldCoord) {
        br.readMethod4();
        br.readMethod4();
    }

    br.readMethod13();
    br.readMethod4();
    br.readMethod13();
    br.readMethod20(6);
    br.readMethod20(6);
    const newInternal = br.readMethod13();
    br.readMethod13();
    br.readMethod13();
    br.readMethod20(1);

    const hasNewCoord = br.readMethod20(1) === 1;
    if (hasNewCoord) {
        br.readMethod45();
        br.readMethod45();
    }

    const isCraftTown = br.readMethod20(1) === 1;
    const transferToken = br.readMethod4();
    const masterClassId = br.readMethod20(4);
    const forgeRank = br.readMethod20(5);
    const keepRank = br.readMethod20(5);
    const towerRank = br.readMethod20(5);
    const tomeRank = br.readMethod20(5);
    const barnRank = br.readMethod20(5);
    const scaffoldingLevel = br.readMethod20(5);

    return {
        newInternal,
        isCraftTown,
        transferToken,
        masterClassId,
        forgeRank,
        keepRank,
        towerRank,
        tomeRank,
        barnRank,
        scaffoldingLevel
    };
}

function buildCraftTownPacket(levelName: string): Buffer {
    return WorldEnter.buildEnterWorldPacket(
        77,
        0,
        '',
        false,
        0,
        0,
        'localhost',
        8080,
        'LevelsHome.swf',
        1,
        1,
        levelName,
        '',
        '',
        true,
        true,
        10,
        20,
        createCharacter()
    ).toBuffer();
}

function testCraftTownTutorialSuppressesKeepUpgradeVisuals(): void {
    const decoded = decodeCraftTownVisualData(buildCraftTownPacket('CraftTownTutorial'));

    assert.equal(decoded.newInternal, 'CraftTownTutorial');
    assert.equal(decoded.isCraftTown, true);
    assert.equal(decoded.keepRank, 0, 'tutorial keep should always render in the ruined baseline state');
    assert.equal(decoded.scaffoldingLevel, 0, 'tutorial keep should not inherit live scaffolding state');
}

function testCraftTownPreservesLiveKeepUpgradeVisuals(): void {
    const decoded = decodeCraftTownVisualData(buildCraftTownPacket('CraftTown'));

    assert.equal(decoded.newInternal, 'CraftTown');
    assert.equal(decoded.isCraftTown, true);
    assert.equal(decoded.keepRank, 5, 'town keep should continue to use the player keep rank');
    assert.equal(decoded.scaffoldingLevel, 12, 'town keep should continue to use the live scaffolding state');
}

function main(): void {
    testCraftTownTutorialSuppressesKeepUpgradeVisuals();
    testCraftTownPreservesLiveKeepUpgradeVisuals();
    console.log('world_enter_crafttown_visual_state_regression: ok');
}

try {
    main();
} catch (error) {
    console.error('world_enter_crafttown_visual_state_regression: failed');
    console.error(error);
    process.exitCode = 1;
}
