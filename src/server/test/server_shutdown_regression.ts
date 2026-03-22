import { strict as assert } from 'assert';
import * as http from 'http';
import * as net from 'net';
import { once } from 'events';
import { AddressInfo } from 'net';
import { PacketRouter } from '../network/packetRouter';
import { GameServer } from '../core/server';
import { StaticServer } from '../core/StaticServer';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutHandle = setTimeout(() => {
                    reject(new Error(`${label} timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            })
        ]);
    } finally {
        if (timeoutHandle) {
            clearTimeout(timeoutHandle);
        }
    }
}

function waitForSocketClose(socket: net.Socket): Promise<void> {
    return new Promise((resolve) => {
        if (socket.destroyed) {
            resolve();
            return;
        }

        socket.once('close', () => resolve());
    });
}

async function testGameServerStopClosesOpenSockets(): Promise<void> {
    const router = new PacketRouter();
    const server = new GameServer(0, router, '127.0.0.1');

    server.start();

    const netServer = (server as any).server as net.Server;
    await once(netServer, 'listening');

    const port = ((netServer.address() as AddressInfo | null)?.port ?? 0);
    assert.ok(port > 0, 'game server should bind to an ephemeral port');

    const socket = net.createConnection({ host: '127.0.0.1', port });
    let closeErrorCode: string | null = null;
    socket.on('error', (error) => {
        closeErrorCode = (error as NodeJS.ErrnoException).code ?? null;
    });
    await once(socket, 'connect');

    const stopPromise = server.stop();
    await withTimeout(stopPromise, 1500, 'GameServer.stop');
    await withTimeout(waitForSocketClose(socket), 1500, 'game client socket close');
    assert.ok(closeErrorCode === null || closeErrorCode === 'ECONNRESET');
}

async function testStaticServerStopClosesKeepAliveConnections(): Promise<void> {
    const server = new StaticServer(0, '../client/content/localhost', '127.0.0.1');
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });

    server.start();

    const httpServer = (server as any).server as http.Server;
    await once(httpServer, 'listening');

    const port = ((httpServer.address() as AddressInfo | null)?.port ?? 0);
    assert.ok(port > 0, 'static server should bind to an ephemeral port');

    await new Promise<void>((resolve, reject) => {
        const request = http.get(
            {
                host: '127.0.0.1',
                port,
                path: '/healthz',
                agent
            },
            (response) => {
                response.resume();
                response.on('end', () => resolve());
            }
        );

        request.on('error', reject);
    });

    try {
        await withTimeout(server.stop(), 1500, 'StaticServer.stop');
    } finally {
        agent.destroy();
    }
}

async function main(): Promise<void> {
    await testGameServerStopClosesOpenSockets();
    await testStaticServerStopClosesKeepAliveConnections();
    console.log('server_shutdown_regression: ok');
}

void main().catch((error) => {
    console.error('server_shutdown_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
