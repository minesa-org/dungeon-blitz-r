import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../../..');
const entTypesPath = path.join(root, 'src/client/content/xml/EntTypes.xml');
const monsterPowerTypesPath = path.join(root, 'src/client/content/xml/MonsterPowerTypes.xml');
const entTypesXml = fs.readFileSync(entTypesPath, 'utf8');
const monsterPowerTypesXml = fs.readFileSync(monsterPowerTypesPath, 'utf8');

function getBlock(xml: string, tag: string, attrName: string, attrValue: string): string {
    const pattern = new RegExp(`<${tag} ${attrName}="${attrValue}"[\\s\\S]*?<\\/${tag}>`);
    const match = xml.match(pattern);
    assert.ok(match, `${attrValue} block must exist`);
    return match[0];
}

function main(): void {
    const expectedCustomArtByEnt = new Map([
        ['DemonHarrier', 'Animation_Puck.swf/Shadow'],
        ['DemonHarrier2', 'Animation_Puck.swf/Shadow2'],
        ['DemonHarrierHard', 'Animation_Puck.swf/Shadow'],
        ['DemonHarrier2Hard', 'Animation_Puck.swf/Shadow2']
    ]);

    for (const [entName, customArt] of expectedCustomArtByEnt) {
        const block = getBlock(entTypesXml, 'EntType', 'EntName', entName);
        assert.match(block, new RegExp(`<CustomArt>${customArt.replace('.', '\\.')}<\\/CustomArt>`));
        assert.doesNotMatch(block, /<CustomArt>Animation_Puck\.swf\/Demon<\/CustomArt>/);
        assert.match(block, /<MeleePower>PuckMelee1<\/MeleePower>/);
    }

    const puckMelee = getBlock(monsterPowerTypesXml, 'Power', 'PowerName', 'PuckMelee1');
    assert.match(puckMelee, /<PowerID>2020<\/PowerID>/);
    assert.match(puckMelee, /<CastAnim>Melee<\/CastAnim>/);
}

try {
    main();
} catch (error) {
    console.error('demon_harrier_art_regression: failed');
    console.error(error);
    process.exit(1);
}
