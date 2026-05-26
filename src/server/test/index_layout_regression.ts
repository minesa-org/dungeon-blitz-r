import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';

function resolveIndexPath(): string {
    const candidates = [
        path.resolve(__dirname, '../../client/content/localhost/index.html'),
        path.resolve(__dirname, '../../../client/content/localhost/index.html'),
        path.resolve(process.cwd(), 'src/client/content/localhost/index.html'),
        path.resolve(process.cwd(), '../client/content/localhost/index.html')
    ];

    const found = candidates.find((candidate) => fs.existsSync(candidate));
    assert.ok(found, 'localhost index.html should exist');
    return found;
}

function main(): void {
    const indexHtml = fs.readFileSync(resolveIndexPath(), 'utf8');

    assert.equal(indexHtml.includes('id="game-shell"'), true, 'Flash host should keep a persistent shell around the embedded game');
    assert.equal(indexHtml.includes('id="game-stage"'), true, 'Flash host should keep a persistent game stage inside the shell');
    assert.equal(indexHtml.includes('transform: scale('), false, 'Flash host should not browser-scale the SWF');
    assert.equal(indexHtml.includes('layout=fit-center-buffer'), false, 'Flash host should not request the fit-center-buffer layout');
    assert.equal(indexHtml.includes('#DungeonBlitz'), true, 'Flash host should pin the embedded SWF object by id');
    assert.equal(indexHtml.includes('#game-shell'), true, 'Flash host should pin the game shell to the viewport');
    assert.equal(indexHtml.includes('#game-stage'), true, 'Flash host should keep the aspect-ratio stage as a stable clipping layer');
    assert.equal(indexHtml.includes('canvas#DungeonBlitz'), true, 'Flash host should constrain FlashBrowser canvas replacements');
    assert.equal(indexHtml.includes('syncGameStageSize'), true, 'Flash host should actively resync detached FlashBrowser surfaces');
    assert.equal(indexHtml.includes('width: min(100dvw, 150dvh) !important'), true, 'Flash host should fit the game viewport within the dynamic viewport width');
    assert.equal(indexHtml.includes('height: min(100dvh, 66.6667dvw) !important'), true, 'Flash host should fit the game viewport within the dynamic viewport height');
    assert.equal(indexHtml.includes('aspect-ratio: 3 / 2'), true, 'Flash host should preserve the game viewport ratio');
    assert.equal(indexHtml.includes('width: 100% !important'), true, 'Flash host should force inner canvas surfaces to fill the constrained viewport');
    assert.equal(indexHtml.includes('height: 100% !important'), true, 'Flash host should force inner canvas surfaces to fill the constrained viewport');
    assert.equal(indexHtml.includes('new MutationObserver(syncGameStageSize)'), true, 'Flash host should watch for detached FlashBrowser surface insertion');
    assert.equal(indexHtml.includes('"1152",'), true, 'Flash host should create the SWF at the native game width');
    assert.equal(indexHtml.includes('"768",'), true, 'Flash host should create the SWF at the native game height');
    assert.equal(
        indexHtml.includes('p/cbp/DungeonBlitz.swf?fv=cbw&gv=cbw'),
        true,
        'Flash host should still request the current DungeonBlitz.swf version'
    );
    assert.equal(
        indexHtml.includes('{ fv: "cbw", gv: "cbw" }'),
        true,
        'FlashVars must match the current SWF version so loaderInfo.parameters.fv requests the served manifest alias'
    );
    assert.equal(
        indexHtml.includes('{ fv: "cbq", gv: "cbp" }'),
        false,
        'Flash host must not pass stale FlashVars that override the SWF URL version'
    );

    console.log('index_layout_regression: ok');
}

main();
