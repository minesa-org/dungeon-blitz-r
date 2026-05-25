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

    assert.equal(indexHtml.includes('id="game-shell"'), true, 'Flash host should keep the original stage-size shell');
    assert.equal(indexHtml.includes('transform: scale('), false, 'Flash host should not use the old direct SWF scale transform');
    assert.equal(indexHtml.includes('layout=fit-center-buffer'), false, 'Flash host should not request the fit-center-buffer layout');
    assert.equal(indexHtml.includes('#DungeonBlitz'), true, 'Flash host should pin the embedded SWF object by id');
    assert.equal(indexHtml.includes('width: 1152px;'), true, 'Flash shell should use the original stage width');
    assert.equal(indexHtml.includes('height: 768px;'), true, 'Flash shell should use the original stage height');
    assert.equal(indexHtml.includes('min-width: 1152px;'), true, 'Page should allow scrolling instead of shrinking below the original width');
    assert.equal(indexHtml.includes('min-height: 768px;'), true, 'Page should allow scrolling instead of shrinking below the original height');
    assert.equal(indexHtml.includes('body.fullscreen #game-shell'), true, 'Flash host should expose a chat-command fullscreen shell mode');
    assert.equal(indexHtml.includes('width: 100dvw;'), false, 'Fullscreen shell should not resize the SWF stage to the viewport width');
    assert.equal(indexHtml.includes('height: 100dvh;'), false, 'Fullscreen shell should not resize the SWF stage to the viewport height');
    assert.equal(indexHtml.includes('scale(var(--game-fullscreen-scale, 1))'), false, 'Fullscreen shell should not browser-scale the SWF bitmap');
    assert.equal(indexHtml.includes('width: var(--game-fullscreen-width, 1152px);'), true, 'Fullscreen shell should resize the Flash surface to the scaled width');
    assert.equal(indexHtml.includes('height: var(--game-fullscreen-height, 768px);'), true, 'Fullscreen shell should resize the Flash surface to the scaled height');
    assert.equal(indexHtml.includes('applyDungeonBlitzFullscreenSize'), true, 'Fullscreen mode should apply the computed render-surface size');
    assert.equal(indexHtml.includes('updateDungeonBlitzFullscreenScale'), true, 'Fullscreen mode should recalculate uniform scale on browser changes');
    assert.equal(indexHtml.includes('window.setDungeonBlitzFullscreen'), true, 'Flash should be able to toggle fullscreen dynamically');
    assert.equal(indexHtml.includes('requestFullscreen'), true, 'Fullscreen toggle should ask the browser for fullscreen when available');
    assert.equal(indexHtml.includes('exitFullscreen'), true, 'Fullscreen toggle should restore the browser window on /fullscreen: off');
    assert.equal(indexHtml.includes('scale: "noscale"'), true, 'Flash host should disable internal SWF scaling');
    assert.equal(indexHtml.includes('salign: "tl"'), true, 'Flash host should anchor the original stage to the top-left');
    assert.equal(indexHtml.includes('quality: "best"'), true, 'Flash host should request best rendering quality');
    assert.equal(indexHtml.includes('wmode: "direct"'), true, 'Flash host should use direct rendering mode when available');
    assert.equal(
        indexHtml.includes('p/cbp/DungeonBlitz.swf?fv=cbw&gv=cbv'),
        true,
        'Flash host should still request the current DungeonBlitz.swf version'
    );

    console.log('index_layout_regression: ok');
}

main();
