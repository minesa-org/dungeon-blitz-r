import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { GlobalState } from '../core/GlobalState';
import { StaticServer } from '../core/StaticServer';

function getSwfBody(buffer: Buffer): Buffer {
    const signature = buffer.subarray(0, 3).toString('ascii');
    return signature === 'CWS' ? zlib.inflateSync(buffer.subarray(8)) : buffer.subarray(8);
}

function testStaticServerServesSingleSwfByDefault(): void {
    const server = new StaticServer();
    const selectedSwfPath = (server as any).getSelectedSwfPath() as string;
    const selectedSwfUrl = (server as any).getSelectedSwfUrl() as string;

    assert.equal(path.basename(selectedSwfPath), 'DungeonBlitz.swf');
    assert.equal(selectedSwfUrl, '/p/cbp/DungeonBlitz.swf?fv=cbw&gv=cbv');
    assert.equal(fs.existsSync(selectedSwfPath), true);
}

function testStaticServerSelectsLocalizedGameSwz(): void {
    const server = new StaticServer();
    const englishPath = (server as any).getGameSwzPathForLocale('en') as string;
    const turkishPath = (server as any).getGameSwzPathForLocale('tr') as string;

    assert.equal(path.basename(englishPath), 'Game.en.swz');
    assert.equal(path.basename(turkishPath), 'Game.tr.swz');
    assert.equal(fs.existsSync(englishPath), true);
    assert.equal(fs.existsSync(turkishPath), true);
}

function testStaticServerAliasesCurrentFlashVersionManifest(): void {
    const server = new StaticServer();
    const manifestPath = (server as any).getFlashVersionAssetPath('/masterFileList.xml') as string;

    assert.equal(path.basename(path.dirname(manifestPath)), 'cbq');
    assert.equal(path.basename(manifestPath), 'masterFileList.xml');
    assert.equal(fs.existsSync(manifestPath), true);
}

function testBrowserShellKeepsOriginalStageSizeWithFullscreenToggle(): void {
    const server = new StaticServer();
    const contentDir = (server as any).contentDir as string;
    const indexHtml = fs.readFileSync(path.join(contentDir, 'index.html'), 'utf8');
    const fullscreenBodyRule = indexHtml.match(/body\.fullscreen\s*\{([\s\S]*?)\n    \}/);
    const shellRule = indexHtml.match(/#game-shell\s*\{([\s\S]*?)\n    \}/);
    const fullscreenShellRule = indexHtml.match(/body\.fullscreen #game-shell\s*\{([\s\S]*?)\n    \}/);
    const embedRule = indexHtml.match(/#game-container,\s*\r?\n\s*#DungeonBlitz,\s*\r?\n\s*object#DungeonBlitz,\s*\r?\n\s*embed#DungeonBlitz\s*\{([\s\S]*?)\n    \}/);

    assert.ok(fullscreenBodyRule, 'DungeonBlitz fullscreen body CSS rule not found');
    assert.ok(shellRule, 'DungeonBlitz original stage-size shell CSS rule not found');
    assert.ok(fullscreenShellRule, 'DungeonBlitz fullscreen shell CSS rule not found');
    assert.ok(embedRule, 'DungeonBlitz embed CSS rule not found');
    assert.equal(indexHtml.includes('id="game-shell"'), true, 'Flash host must wrap the game in the original stage-size shell');
    assert.equal(
        /width:\s*1152px/.test(shellRule[1]) && /height:\s*768px/.test(shellRule[1]),
        true,
        'DungeonBlitz shell must keep the original 1152x768 stage size'
    );
    assert.equal(
        indexHtml.includes('min-width: 1152px;') && indexHtml.includes('min-height: 768px;'),
        true,
        'Browser page must scroll instead of shrinking below the original stage size'
    );
    assert.equal(
        /min-width:\s*0/.test(fullscreenBodyRule[1]) && /min-height:\s*0/.test(fullscreenBodyRule[1]),
        true,
        'Fullscreen mode must release the original-size page minimums'
    );
    assert.equal(
        /position:\s*fixed/.test(fullscreenShellRule[1]) &&
            /left:\s*50%/.test(fullscreenShellRule[1]) &&
            /top:\s*50%/.test(fullscreenShellRule[1]),
        true,
        'Fullscreen mode must center the original shell in the viewport'
    );
    assert.equal(
        /width:\s*var\(--game-fullscreen-width,\s*1152px\)/.test(fullscreenShellRule[1]) &&
            /height:\s*var\(--game-fullscreen-height,\s*768px\)/.test(fullscreenShellRule[1]),
        true,
        'Fullscreen mode must resize the Flash surface to the scaled dimensions'
    );
    assert.equal(
        /scale\(var\(--game-fullscreen-scale,\s*1\)\)/.test(fullscreenShellRule[1]) ||
            /transform\s*:\s*scale/.test(fullscreenShellRule[1]),
        false,
        'Fullscreen mode must not browser-scale the SWF bitmap'
    );
    assert.equal(
        /transform\s*:\s*scale/.test(embedRule[1]),
        false,
        'DungeonBlitz embed must not browser-scale the SWF'
    );
    assert.equal(
        /--game-fill/.test(embedRule[1]),
        false,
        'DungeonBlitz embed must not use a crop/fill multiplier'
    );
    assert.equal(
        /position:\s*fixed/.test(embedRule[1]) || /inset:\s*0/.test(embedRule[1]),
        false,
        'DungeonBlitz embed must not be stretched to the viewport'
    );
    assert.equal(
        /width:\s*100dvw\s*!important/.test(embedRule[1]),
        false,
        'DungeonBlitz embed must not fill the dynamic viewport width'
    );
    assert.equal(
        /height:\s*100dvh\s*!important/.test(embedRule[1]),
        false,
        'DungeonBlitz embed must not fill the dynamic viewport height'
    );
    assert.equal(
        /width:\s*100%\s*!important/.test(embedRule[1]) && /height:\s*100%\s*!important/.test(embedRule[1]),
        true,
        'DungeonBlitz embed must fill only the fixed original-size shell'
    );
    assert.equal(
        /aspect-ratio/.test(embedRule[1]),
        false,
        'DungeonBlitz embed must not force a viewport-derived aspect ratio'
    );
    assert.equal(
        indexHtml.includes('scale: "noscale"') && indexHtml.includes('salign: "tl"'),
        true,
        'Flash host must preserve the original stage without internal scaling'
    );
    assert.equal(
        indexHtml.includes('quality: "best"'),
        true,
        'Flash host must request best rendering quality'
    );
    assert.equal(
        indexHtml.includes('wmode: "direct"'),
        true,
        'Flash host must use direct rendering mode when available'
    );
    assert.equal(
        indexHtml.includes('applyDungeonBlitzFullscreenSize') &&
            indexHtml.includes('--game-fullscreen-width') &&
            indexHtml.includes('--game-fullscreen-height'),
        true,
        'Fullscreen mode must apply real render-surface dimensions instead of compositor scaling'
    );
    assert.equal(
            indexHtml.includes('window.setDungeonBlitzFullscreen') &&
            indexHtml.includes('updateDungeonBlitzFullscreenScale') &&
            indexHtml.includes('requestFullscreen') &&
            indexHtml.includes('exitFullscreen'),
        true,
        'Flash host must expose the /fullscreen browser toggle'
    );
}

function testStaticServerResolvesGameSwzLocaleFromRequest(): void {
    const server = new StaticServer();
    const queryRequest = {
        query: { lang: 'tr' },
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const sessionRequest = {
        query: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };
    const defaultRequest = {
        query: {},
        headers: {},
        socket: { remoteAddress: '127.0.0.1' }
    };

    assert.equal((server as any).resolveGameSwzLocale(queryRequest), 'tr');
    assert.equal((server as any).resolveSwfLocale(queryRequest), 'tr');
    assert.equal((server as any).resolveGameSwzLocale(defaultRequest), 'en');
    assert.equal((server as any).resolveSwfLocale(defaultRequest), 'en');

    GlobalState.sessionsByToken.set(1, {
        socket: { remoteAddress: '127.0.0.1' },
        playerSpawned: true,
        character: { dialogueLanguage: 'tr' }
    } as never);
    try {
        assert.equal((server as any).resolveGameSwzLocale(sessionRequest), 'tr');
        assert.equal((server as any).resolveSwfLocale(sessionRequest), 'tr');
    } finally {
        GlobalState.sessionsByToken.delete(1);
    }
}

function testStaticServerBuildsLocalizedSwfTextByLocale(): void {
    const server = new StaticServer();
    const englishBody = getSwfBody((server as any).getSelectedSwfBuffer('en') as Buffer);
    const turkishBody = getSwfBody((server as any).getSelectedSwfBuffer('tr') as Buffer);
    const englishDiscipline = Buffer.from('Blessed by the Storm Gods, you draw enemy wrath', 'utf8');
    const turkishDiscipline = Buffer.from('Firtina Tanrilari tarafindan kutsanmis olarak', 'utf8');

    assert.equal(englishBody.includes(englishDiscipline), true);
    assert.equal(englishBody.includes(turkishDiscipline), false);
    assert.equal(turkishBody.includes(englishDiscipline), false);
    assert.equal(turkishBody.includes(turkishDiscipline), true);
}

function testDungeonBlitzSwfRequestsBestStageQuality(): void {
    const server = new StaticServer();
    const body = getSwfBody((server as any).getSelectedSwfBuffer('en') as Buffer);

    assert.equal(body.includes(Buffer.from('StageQuality', 'utf8')), true);
    assert.equal(body.includes(Buffer.from('BEST', 'utf8')), true);
}

function main(): void {
    testStaticServerServesSingleSwfByDefault();
    testStaticServerSelectsLocalizedGameSwz();
    testStaticServerAliasesCurrentFlashVersionManifest();
    testBrowserShellKeepsOriginalStageSizeWithFullscreenToggle();
    testStaticServerResolvesGameSwzLocaleFromRequest();
    testStaticServerBuildsLocalizedSwfTextByLocale();
    testDungeonBlitzSwfRequestsBestStageQuality();
    console.log('static_server_default_swf_regression: ok');
}

main();
