import * as net from 'net';
import { Client } from './Client';
import { PacketRouter } from '../network/packetRouter';
import { Config } from './config';

export class GameServer {
    private server: net.Server;
    private port: number;
    private host: string;
    private router: PacketRouter;
    private readonly sockets: Set<net.Socket>;

    constructor(port: number = 8080, router: PacketRouter, host: string = Config.BIND_HOST) {
        this.port = port;
        this.router = router;
        this.host = host;
        this.sockets = new Set();
        this.server = net.createServer((socket) => this.handleConnection(socket));
        this.server.on('error', (error) => {
            const socketError = error as NodeJS.ErrnoException;
            if (socketError.code === 'EADDRINUSE') {
                console.error(
                    `[GameServer] Cannot listen on ${this.host}:${this.port} because the port is already in use.`
                );
                console.error('[GameServer] Stop the previous dev server or change GAME_PORT before restarting.');
                process.exitCode = 1;
                setImmediate(() => process.exit(1));
                return;
            }

            console.error('[GameServer] Server error:', error);
        });
    }

    public start(): void {
        this.server.listen(this.port, this.host, () => {
            console.log(`[GameServer] Listening on ${this.host}:${this.port}`);
        });
    }

    public stop(): Promise<void> {
        if (!this.server.listening && this.sockets.size === 0) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            this.closeSockets();
            this.server.close((error) => {
                if (error) {
                    const socketError = error as NodeJS.ErrnoException;
                    if (socketError.code === 'ERR_SERVER_NOT_RUNNING') {
                        resolve();
                        return;
                    }

                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }

    private handleConnection(socket: net.Socket): void {
        this.sockets.add(socket);
        socket.on('close', () => {
            this.sockets.delete(socket);
        });

        // Create Client wrapper
        const client = new Client(socket, this.router);
        const addr = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`[GameServer] Client connected: ${addr}`);
    }

    private closeSockets(): void {
        for (const socket of Array.from(this.sockets)) {
            if (socket.destroyed) {
                this.sockets.delete(socket);
                continue;
            }

            socket.end();
            socket.destroySoon?.();

            const destroyTimer = setTimeout(() => {
                if (!socket.destroyed) {
                    socket.destroy();
                }
            }, 250);
            destroyTimer.unref?.();
        }
    }
}
