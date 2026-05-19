import { strict as assert } from 'assert';
import * as path from 'path';
import { GameData } from '../core/GameData';
import { LevelConfig } from '../core/LevelConfig';

function allDropGearIds(): number[] {
    const ids = new Set<number>();
    for (const dropIds of Object.values(GameData.GEAR_DATA.realm_drops)) {
        for (const gearId of dropIds) {
            ids.add(gearId);
        }
    }
    for (const dropIds of Object.values(GameData.GEAR_DATA.boss_drops)) {
        for (const gearId of dropIds) {
            ids.add(gearId);
        }
    }
    for (const gearId of GameData.GEAR_DATA.global_drops) {
        ids.add(gearId);
    }
    return Array.from(ids.values());
}

function excludedGearIdsExcept(...allowedGearIds: number[]): number[] {
    const allowed = new Set(allowedGearIds);
    return allDropGearIds().filter((gearId) => !allowed.has(gearId));
}

function testValhavenLevelNamesNormalizeFromInternalSwfNames(): void {
    const jadeCityLevels = [
        'JC_Mission1',
        'JC_Mission2',
        'JC_Mission3',
        'JC_Mission4',
        'JC_Mission5',
        'JC_Mission6',
        'JC_Mission7',
        'JC_Mission8',
        'JC_Mission9',
        'JC_Mission10',
        'JC_Mission11',
        'JC_Mini1',
        'JC_Mini2'
    ];

    for (const levelName of jadeCityLevels) {
        const internalName = `a_Level_${levelName.replace(/^JC_/, 'JC')}`;
        assert.equal(
            LevelConfig.normalizeLevelName(internalName),
            levelName,
            `${internalName} should normalize to ${levelName}`
        );
        assert.equal(
            LevelConfig.normalizeLevelName(`LevelsJC.swf/${internalName}`),
            levelName,
            `SWF path for ${internalName} should normalize to ${levelName}`
        );

        const hardLevelName = `${levelName}Hard`;
        const hardInternalName = `${internalName}Hard`;
        assert.equal(
            LevelConfig.normalizeLevelName(hardInternalName),
            hardLevelName,
            `${hardInternalName} should normalize to ${hardLevelName}`
        );
    }
}

function testRealmDropsRequireMatchingDungeon(): void {
    const onlyHuman12MageGloves = excludedGearIdsExcept(522);
    assert.equal(
        GameData.getGearIdForEntity('BanditRogue', 'Mage', onlyHuman12MageGloves, 'BT_Mission1'),
        522,
        'Human12 realm gear should drop from Humans in Bandit Camp'
    );
    assert.equal(
        GameData.getGearIdForEntity('BanditRogue', 'Mage', onlyHuman12MageGloves, 'BT_Mission4'),
        0,
        'Human12 realm gear should not drop from Humans in another Felbridge dungeon'
    );

    const onlyHuman14MageFocus = excludedGearIdsExcept(512);
    assert.equal(
        GameData.getGearIdForEntity('MeylourMage', 'Mage', onlyHuman14MageFocus, 'BT_Mission4'),
        512,
        'Human14 realm gear should drop from Humans in Dereliction of Duty'
    );
    assert.equal(
        GameData.getGearIdForEntity('MeylourMage', 'Mage', onlyHuman14MageFocus, 'BT_Mission1'),
        0,
        'Human14 realm gear should not leak into Bandit Camp'
    );
}

function testMummyDropsRequireMausoleum(): void {
    const onlyMummy14MageBoots = excludedGearIdsExcept(426);
    assert.equal(
        GameData.getGearIdForEntity('Mummy', 'Mage', onlyMummy14MageBoots, 'CH_Mission6'),
        426,
        'Mummy14 realm gear should drop in Mausoleum of the Wise'
    );
    assert.equal(
        GameData.getGearIdForEntity('Mummy', 'Mage', onlyMummy14MageBoots, 'CH_Mission5'),
        0,
        'Mummy14 realm gear should not drop in a different Cemetery Hill dungeon'
    );
}

function testJadeCityRealmDropsUseCanonicalDungeonNames(): void {
    const onlyHuman27MageStaff = excludedGearIdsExcept(1048);
    assert.equal(
        GameData.getGearIdForEntity('BrigandCryomancer', 'Mage', onlyHuman27MageStaff, 'JC_Mission11'),
        1048,
        'Human27 realm gear should drop from Human mobs in the client-authored Jade City source'
    );
    assert.equal(
        GameData.getGearIdForEntity('BrigandCryomancer', 'Mage', onlyHuman27MageStaff, 'JC_Mission9'),
        0,
        'Human27 realm gear should not leak into Hiding Out'
    );
    assert.equal(
        GameData.getGearIdForEntity('BrigandCryomancer', 'Mage', onlyHuman27MageStaff, 'JC_Mission2'),
        0,
        'Human27 realm gear should not use neighboring Jade City dungeon base levels as fallback'
    );
    assert.equal(
        GameData.getGearIdForEntity('BrigandCryomancer', 'Mage', onlyHuman27MageStaff, 'BT_Mission1'),
        0,
        'Human27 realm gear should not leak into unrelated dungeons'
    );

    const onlyShade27MageGear = excludedGearIdsExcept(1047, 1051, 1055, 1062);
    assert.notEqual(
        GameData.getGearIdForEntity('ShadeSummoner', 'Mage', onlyShade27MageGear, 'JC_Mission5'),
        0,
        'Shade27 realm gear should drop from Shade lieutenants in Fable of the Lost Temple'
    );
    assert.notEqual(
        GameData.getGearIdForEntity('ShadeSummoner', 'Mage', onlyShade27MageGear, 'a_Level_JCMission5'),
        0,
        'Shade27 realm gear should drop when the current level is supplied as the internal SWF level name'
    );
    assert.notEqual(
        GameData.getGearIdForEntity('ShadeSummoner', 'Mage', onlyShade27MageGear, 'LevelsJC.swf/a_Level_JCMission5'),
        0,
        'Shade27 realm gear should drop when the current level is supplied as a SWF path'
    );

    const onlyDemon29MageGear = excludedGearIdsExcept(1131, 1139, 1146, 1157);
    assert.notEqual(
        GameData.getGearIdForEntity('GreaterDemonMaligner', 'Mage', onlyDemon29MageGear, 'JC_Mission5'),
        0,
        'Demon29 realm gear should drop from Demon lieutenants in Fable of the Lost Temple'
    );

    const onlySkeleton28MageGear = excludedGearIdsExcept(1039, 1065);
    assert.notEqual(
        GameData.getGearIdForEntity('BoneGolem', 'Mage', onlySkeleton28MageGear, 'JC_Mission3'),
        0,
        'Skeleton28 realm gear should drop in its client-authored Jade City source'
    );
    assert.equal(
        GameData.getGearIdForEntity('BoneGolem', 'Mage', onlySkeleton28MageGear, 'JC_Mission5'),
        0,
        'Skeleton28 realm gear should not leak into Fable via authored base level fallback'
    );

    const onlyRatling29MageGear = excludedGearIdsExcept(1138, 1149);
    assert.notEqual(
        GameData.getGearIdForEntity('RatlingShamanHood', 'Mage', onlyRatling29MageGear, 'JC_Mission4'),
        0,
        'Ratling29 realm gear should drop in its client-authored Jade City source'
    );
    assert.equal(
        GameData.getGearIdForEntity('RatlingShamanHood', 'Mage', onlyRatling29MageGear, 'JC_Mission9'),
        0,
        'Ratling29 realm gear should not leak into Hiding Out'
    );

    const onlyRaptor29MageGear = excludedGearIdsExcept(1137, 1145);
    assert.notEqual(
        GameData.getGearIdForEntity('SewerRaptorGreater', 'Mage', onlyRaptor29MageGear, 'JC_Mission4'),
        0,
        'Raptor29 realm gear should drop in its client-authored Jade City source'
    );
    assert.equal(
        GameData.getGearIdForEntity('SewerRaptorGreater', 'Mage', onlyRaptor29MageGear, 'JC_Mission9'),
        0,
        'Raptor29 realm gear should not leak into Hiding Out'
    );

    const onlyImperial27MageGear = excludedGearIdsExcept(1040, 1045, 1052, 1053, 1067);
    assert.notEqual(
        GameData.getGearIdForEntity('ImperialGuard', 'Mage', onlyImperial27MageGear, 'JC_Mission1'),
        0,
        'Imperial27 realm gear should drop in its client-authored Jade City source'
    );

    const onlySpirit29MageGear = excludedGearIdsExcept(1130, 1143);
    assert.notEqual(
        GameData.getGearIdForEntity('SpiritGoblinLt1', 'Mage', onlySpirit29MageGear, 'JC_Mission6'),
        0,
        'Spirit29 realm gear should drop in its client-authored Jade City source'
    );
}

function testRealmLevelSourcesCanMapToMultipleDungeons(): void {
    const onlyImperial29MageNatureStaff = excludedGearIdsExcept(1140);
    assert.equal(
        GameData.getGearIdForEntity('ImperialGuard', 'Mage', onlyImperial29MageNatureStaff, 'JC_Mini1'),
        1140,
        'Imperial29 realm gear should drop in its client-authored Jade City source'
    );
    assert.equal(
        GameData.getGearIdForEntity('ImperialGuard', 'Mage', onlyImperial29MageNatureStaff, 'JC_Mission8'),
        0,
        'Imperial29 realm gear should not use matching base level when the client source map points elsewhere'
    );
    assert.equal(
        GameData.getGearIdForEntity('ImperialGuard', 'Mage', onlyImperial29MageNatureStaff, 'JC_Mission4'),
        0,
        'Imperial29 realm gear should not drop in Imperial dungeons with a different source level'
    );
    assert.equal(
        GameData.getGearIdForEntity('ImperialMagi2', 'Mage', onlyImperial29MageNatureStaff, 'JC_Mini1'),
        1140,
        'Imperial level-29 mage gear should drop from Imperial Jade City lieutenants in the client source'
    );
    assert.equal(
        GameData.getGearIdForEntity('ImperialMagi2', 'Mage', onlyImperial29MageNatureStaff, 'JC_Mission7'),
        0,
        'Imperial level-29 mage gear should not drop in neighboring Imperial dungeons with a different dungeon level'
    );
}

function testBossDropsRequireBossAndDungeon(): void {
    const onlyBanditTwinMageBoots = excludedGearIdsExcept(515);
    assert.equal(
        GameData.getGearIdForEntity('BanditTwinB', 'Mage', onlyBanditTwinMageBoots, 'BT_Mission1'),
        515,
        'BanditTwinB boss gear should drop from BanditTwinB in Bandit Camp'
    );
    assert.equal(
        GameData.getGearIdForEntity('BanditTwinBHard', 'Mage', onlyBanditTwinMageBoots, 'BT_Mission1Hard'),
        515,
        'hard-mode BanditTwinB should use the same boss source in the hard dungeon'
    );
    assert.equal(
        GameData.getGearIdForEntity('BanditTwinB', 'Mage', onlyBanditTwinMageBoots, 'BT_Mission4'),
        0,
        'BanditTwinB boss gear should not drop outside Bandit Camp'
    );
    assert.equal(
        GameData.getGearIdForEntity('BanditRogue', 'Mage', onlyBanditTwinMageBoots, 'BT_Mission1'),
        0,
        'boss gear should not drop from regular enemies in the same dungeon'
    );

    const onlyHuman14MageFocus = excludedGearIdsExcept(512);
    assert.equal(
        GameData.getGearIdForEntity('BanditTwinB', 'Mage', onlyHuman14MageFocus, 'BT_Mission1'),
        0,
        'bosses should not fall back to realm gear when boss gear is unavailable'
    );

    const onlyMummyBossMageFocus = excludedGearIdsExcept(422);
    assert.equal(
        GameData.getGearIdForEntity('MummyBoss', 'Mage', onlyMummyBossMageFocus, 'CH_Mission6'),
        422,
        'MummyBoss gear should drop from MummyBoss in Mausoleum of the Wise'
    );
    assert.equal(
        GameData.getGearIdForEntity('MummyBoss', 'Mage', onlyMummyBossMageFocus, 'CH_Mission5'),
        0,
        'MummyBoss gear should not drop in a different Cemetery Hill dungeon'
    );

    const onlySwampSpiderQueenMageHat = excludedGearIdsExcept(525);
    assert.equal(
        GameData.getGearIdForEntity('SwampSpiderQueen', 'Mage', onlySwampSpiderQueenMageHat, 'SwampRoadConnectionMission'),
        525,
        'the first boss entry in the client drop table should keep its authored dungeon'
    );
    assert.equal(
        GameData.getGearIdForEntity('SwampSpiderQueen', 'Mage', onlySwampSpiderQueenMageHat, 'SRN_Mission6'),
        0,
        'the first boss entry should not be shifted into the realm-location table'
    );
}

function testOwnedMagicGearDoesNotBlockRareGear(): void {
    const defectorMageMageIds = [1049, 1058, 1063];
    const ownedDefectorMagic = defectorMageMageIds.map((gearId) => GameData.buildGearTierKey(gearId, 0));

    assert.ok(
        defectorMageMageIds.includes(
            GameData.getGearIdForEntity('DefectorMage', 'Mage', undefined, 'JC_Mission3', 1, ownedDefectorMagic)
        ),
        'owning DefectorMage magic gear should not block the same boss gear at rare tier'
    );
    assert.equal(
        GameData.getGearIdForEntity('DefectorMage', 'Mage', undefined, 'JC_Mission3', 0, ownedDefectorMagic),
        0,
        'owning DefectorMage magic gear should still block duplicate magic-tier drops'
    );

    const shadeMageIds = [1047, 1051, 1055, 1062];
    const ownedShadeMagic = shadeMageIds.map((gearId) => GameData.buildGearTierKey(gearId, 0));
    assert.ok(
        shadeMageIds.includes(
            GameData.getGearIdForEntity('ShadeSummoner', 'Mage', undefined, 'JC_Mission5', 1, ownedShadeMagic)
        ),
        'owning realm magic gear should not block the same realm gear at rare tier'
    );
    assert.equal(
        GameData.getGearIdForEntity('ShadeSummoner', 'Mage', undefined, 'JC_Mission5', 0, ownedShadeMagic),
        0,
        'owning realm magic gear should still block duplicate magic-tier drops'
    );
}

function main(): void {
    const dataDir = path.resolve(__dirname, '../data');
    LevelConfig.load(dataDir);
    GameData.load(dataDir);

    testValhavenLevelNamesNormalizeFromInternalSwfNames();
    testRealmDropsRequireMatchingDungeon();
    testMummyDropsRequireMausoleum();
    testJadeCityRealmDropsUseCanonicalDungeonNames();
    testRealmLevelSourcesCanMapToMultipleDungeons();
    testBossDropsRequireBossAndDungeon();
    testOwnedMagicGearDoesNotBlockRareGear();

    console.log('gear_drop_source_regression passed');
}

main();
