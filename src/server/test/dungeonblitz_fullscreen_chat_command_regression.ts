import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

function resolveSwfPath(): string {
    const candidates = [
        path.resolve(__dirname, '../../client/content/localhost/p/cbp/DungeonBlitz.swf'),
        path.resolve(__dirname, '../../../client/content/localhost/p/cbp/DungeonBlitz.swf'),
        path.resolve(process.cwd(), 'src/client/content/localhost/p/cbp/DungeonBlitz.swf')
    ];

    const found = candidates.find((candidate) => fs.existsSync(candidate));
    assert.ok(found, 'DungeonBlitz.swf should exist');
    return found;
}

function getSwfBody(buffer: Buffer): Buffer {
    const signature = buffer.subarray(0, 3).toString('ascii');
    return signature === 'CWS' ? zlib.inflateSync(buffer.subarray(8)) : buffer.subarray(8);
}

function main(): void {
    const swfBody = getSwfBody(fs.readFileSync(resolveSwfPath()));
    const requiredStrings = [
        'setDungeonBlitzFullscreen',
        'Experimental fullscreen enabled.',
        'Experimental fullscreen disabled; game restored to original size.',
        'StageScaleMode',
        'SHOW_ALL',
        'NO_SCALE',
        'FULLSCREEN:',
        'fullscreen'
    ];

    for (const value of requiredStrings) {
        assert.equal(
            swfBody.includes(Buffer.from(value, 'utf8')),
            true,
            `DungeonBlitz.swf should include fullscreen chat command string: ${value}`
        );
    }

    console.log('dungeonblitz_fullscreen_chat_command_regression: ok');
}

main();
