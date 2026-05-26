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
    assert.equal(indexHtml.includes('box-sizing: border-box'), true, 'Flash host should include borders in constrained viewport sizing');
    assert.equal(indexHtml.includes('background: #484955'), true, 'Flash host should use the site background color behind the game');
    assert.equal(indexHtml.includes('padding: 0 0 70px'), true, 'Flash host body should reserve bottom browser chrome space');
    assert.equal(indexHtml.includes('transform: scale('), false, 'Flash host should not browser-scale the SWF');
    assert.equal(indexHtml.includes('layout=fit-center-buffer'), false, 'Flash host should not request the fit-center-buffer layout');
    assert.equal(indexHtml.includes('#DungeonBlitz'), true, 'Flash host should pin the embedded SWF object by id');
    assert.equal(indexHtml.includes('#game-shell'), true, 'Flash host should pin the game shell to the viewport');
    assert.equal(indexHtml.includes('top: 40px'), true, 'Flash host should reserve the top browser chrome offset');
    assert.equal(indexHtml.includes('bottom: 70px'), true, 'Flash host should reserve the bottom browser chrome offset');
    assert.equal(indexHtml.includes('#game-stage'), true, 'Flash host should keep the aspect-ratio stage as a stable clipping layer');
    assert.equal(indexHtml.includes('canvas#DungeonBlitz'), true, 'Flash host should constrain FlashBrowser canvas replacements');
    assert.equal(indexHtml.includes('syncGameStageSize'), true, 'Flash host should actively resync detached FlashBrowser surfaces');
    assert.equal(indexHtml.includes('getBoundingClientRect()'), true, 'Flash host should size the game from the visible shell, not the full window');
    assert.equal(indexHtml.includes('width: min(100dvw, 150dvh) !important'), true, 'Flash host should fit the game viewport within the dynamic viewport width');
    assert.equal(indexHtml.includes('height: min(100dvh, 66.6667dvw) !important'), true, 'Flash host should fit the game viewport within the dynamic viewport height');
    assert.equal(indexHtml.includes('aspect-ratio: 3 / 2'), true, 'Flash host should preserve the game viewport ratio');
    assert.equal(indexHtml.includes('border-right: 1px solid #484955'), true, 'Flash host should mirror the left visual border on the right without increasing viewport width');
    assert.equal(indexHtml.includes('width: 100% !important'), true, 'Flash host should force inner canvas surfaces to fill the constrained viewport');
    assert.equal(indexHtml.includes('height: 100% !important'), true, 'Flash host should force inner canvas surfaces to fill the constrained viewport');
    assert.equal(indexHtml.includes('new MutationObserver(requestGameStageSizeSync)'), true, 'Flash host should watch for detached FlashBrowser surface insertion');
    assert.equal(indexHtml.includes('attributes: true'), true, 'Flash host should resync after FlashBrowser mutates canvas/object dimensions');
    assert.equal(indexHtml.includes('new ResizeObserver(requestGameStageSizeSync)'), true, 'Flash host should resync after shell or stage size changes');
    assert.equal(indexHtml.includes('refreshGameSurfaceResizeTargets'), true, 'Flash host should refresh observed game surface targets after replacements');
    assert.equal(indexHtml.includes('"#game-stage canvas"'), true, 'Flash host should observe FlashBrowser canvas surface size changes');
    assert.equal(indexHtml.includes('"#game-stage object"'), true, 'Flash host should observe embedded object surface size changes');
    assert.equal(indexHtml.includes('"#game-stage embed"'), true, 'Flash host should observe embedded Flash surface size changes');
    assert.equal(indexHtml.includes('fullscreenchange'), true, 'Flash host should resync when fullscreen state changes');
    assert.equal(indexHtml.includes('setInterval(requestGameStageSizeSync, 1000)'), true, 'Flash host should periodically heal room-change surface drift');
    assert.equal(indexHtml.includes('align: "center"'), true, 'Flash host should request centered Flash object alignment');
    assert.equal(indexHtml.includes('setAttribute("align", "center")'), true, 'Flash host should keep replaced game surfaces center-aligned');
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
