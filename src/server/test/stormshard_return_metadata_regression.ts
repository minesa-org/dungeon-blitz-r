import assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { parseSwz } from '../scripts/swzPatchUtils';

type RequiredMissionMetadata = {
    missionName: string;
    contactName: string;
    returnName: string;
};

const REQUIRED_MISSIONS: RequiredMissionMetadata[] = [
    {
        missionName: 'GardenOfTheLost',
        contactName: 'OMM_Moai01',
        returnName: 'OMM_Moai01'
    },
    {
        missionName: 'ForgottenForge',
        contactName: 'OMM_Statue01',
        returnName: 'OMM_Statue01'
    },
    {
        missionName: 'GardenOfTheLostHard',
        contactName: 'OMM_Moai01Hard',
        returnName: 'OMM_Moai01Hard'
    },
    {
        missionName: 'ForgottenForgeHard',
        contactName: 'OMM_Statue01Hard',
        returnName: 'OMM_Statue01Hard'
    }
];

function repoRoot(): string {
    return path.resolve(__dirname, '..', '..', '..');
}

function getMissionEntry(xml: string, missionName: string): string {
    const entries = xml.match(/<MissionType>[\s\S]*?<\/MissionType>/g) ?? [];
    const entry = entries.find((candidate) => candidate.includes(`<MissionName>${missionName}</MissionName>`));
    assert.ok(entry, `${missionName} should exist in MissionTypes`);
    return entry;
}

function tagValue(entry: string, tagName: string): string {
    return entry.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`))?.[1]?.trim() ?? '';
}

function assertReturnMetadata(xml: string, label: string): void {
    for (const mission of REQUIRED_MISSIONS) {
        const entry = getMissionEntry(xml, mission.missionName);
        assert.equal(
            tagValue(entry, 'ContactName'),
            mission.contactName,
            `${label} ${mission.missionName} should expose the contact NPC`
        );
        assert.equal(
            tagValue(entry, 'ReturnName'),
            mission.returnName,
            `${label} ${mission.missionName} should expose the turn-in NPC`
        );
        assert.notEqual(
            tagValue(entry, 'TrackerReturn'),
            '',
            `${label} ${mission.missionName} should show return guidance after completion`
        );
        assert.notEqual(
            tagValue(entry, 'ReturnText'),
            '',
            `${label} ${mission.missionName} should have turn-in dialogue text`
        );
    }
}

function testSourceMissionTypesExposeStormshardReturnMetadata(): void {
    const xml = fs.readFileSync(path.join(repoRoot(), 'src/client/content/xml/MissionTypes.xml'), 'utf8');
    assertReturnMetadata(xml, 'source MissionTypes.xml');
}

function testPackedGameSwzExposeStormshardReturnMetadata(): void {
    const cbqDir = path.join(repoRoot(), 'src/client/content/localhost/p/cbq');
    const swzPaths = ['Game.swz', 'Game.en.swz', 'Game.tr.swz']
        .map((fileName) => path.join(cbqDir, fileName))
        .filter((swzPath) => fs.existsSync(swzPath));

    assert.ok(swzPaths.length > 0, 'at least one Game SWZ should exist');

    for (const swzPath of swzPaths) {
        const missionTypes = parseSwz(swzPath).chunks.find((chunk) => chunk.xml.match(/<MissionTypes[>\s]/));
        assert.ok(missionTypes, `${path.basename(swzPath)} should contain MissionTypes`);
        assertReturnMetadata(missionTypes!.xml, path.basename(swzPath));
    }
}

function main(): void {
    testSourceMissionTypesExposeStormshardReturnMetadata();
    testPackedGameSwzExposeStormshardReturnMetadata();
    console.log('stormshard_return_metadata_regression: ok');
}

try {
    main();
} catch (error) {
    console.error('stormshard_return_metadata_regression: failed');
    console.error(error);
    process.exitCode = 1;
}
