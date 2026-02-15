import * as net from 'net';
import { Client } from './Client';
import { PacketRouter } from '../network/packetRouter';

export class GameServer {
    private server: net.Server;
    private port: number;
    private router: PacketRouter;

    constructor(port: number = 8080, router: PacketRouter) {
        this.port = port;
        this.router = router;
        this.server = net.createServer((socket) => this.handleConnection(socket));
    }

    public start(): void {
        this.server.listen(this.port, () => {
            console.log(`[GameServer] Listening on port ${this.port}`);
        });
    }

    private handleConnection(socket: net.Socket): void {
        // Create Client wrapper
        const client = new Client(socket, this.router);
        const addr = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`[GameServer] Client connected: ${addr}`);
    }
}
