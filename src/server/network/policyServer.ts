import * as net from 'net';

const POLICY_XML = `<?xml version="1.0"?>
<!DOCTYPE cross-domain-policy SYSTEM
  "http://www.adobe.com/xml/dtds/cross-domain-policy.dtd">
<cross-domain-policy>
  <allow-access-from domain="*" to-ports="1-65535" secure="false"/>
</cross-domain-policy>\0`;

export class PolicyServer {
    private server: net.Server;
    private port: number;

    constructor(port: number = 843) {
        this.port = port;
        this.server = net.createServer((socket) => this.handleConnection(socket));
    }

    public start(): void {
        this.server.listen(this.port, () => {
            console.log(`[Policy] Server listening on port ${this.port}`);
        });

        this.server.on('error', (err) => {
            console.error(`[Policy] Server error:`, err);
        });
    }

    private handleConnection(socket: net.Socket): void {
        socket.setTimeout(3000); // 3 seconds timeout
        socket.setEncoding('utf8');

        socket.on('data', (data) => {
            const strData = data.toString();
            if (strData.includes('<policy-file-request/>')) {
                // console.log(`[Policy] Sending policy to ${socket.remoteAddress}`);
                socket.write(POLICY_XML);
            }
            socket.end();
        });

        socket.on('timeout', () => {
             socket.end();
        });

        socket.on('error', (err) => {
            // console.error(`[Policy] Socket error: ${err.message}`);
        });
    }
}
