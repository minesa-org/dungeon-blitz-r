import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { Config } from './config';

function resolveContentDir(relativeContentPath: string): string {
    const candidates = [
        path.resolve(Config.DATA_DIR, relativeContentPath),
        path.resolve(__dirname, relativeContentPath),
        path.resolve(process.cwd(), relativeContentPath),
        path.resolve(process.cwd(), '../client/content/localhost'),
        path.resolve(process.cwd(), 'src/client/content/localhost')
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'index.html'))) {
            return candidate;
        }
    }

    return candidates[0];
}

export class StaticServer {
    private app: express.Application;
    private port: number;
    private contentDir: string;
    private host: string;

    constructor(
        port: number = Config.STATIC_PORT,
        relativeContentPath: string = '../client/content/localhost',
        host: string = Config.BIND_HOST
    ) {
        this.port = port;
        this.host = host;
        this.app = express();
        
        // Resolve against the server root so dist and ts-node use the same content directory.
        this.contentDir = resolveContentDir(relativeContentPath);
        
        this.setupRoutes();
    }

    private setupRoutes(): void {
        this.app.use((req, res, next) => {
            const shouldLog =
                req.path === '/' ||
                req.path.endsWith('.swf') ||
                req.path.endsWith('.swz') ||
                req.path.endsWith('.xml');

            if (shouldLog) {
                res.on('finish', () => {
                    console.log(`[StaticServer] ${res.statusCode} ${req.method} ${req.path}`);
                });
            }

            if (req.path.endsWith('.swf') || req.path.endsWith('.swz')) {
                res.type('application/x-shockwave-flash');
            }

            if (
                req.path === '/' ||
                req.path.endsWith('.swf') ||
                req.path.endsWith('.swz') ||
                req.path.endsWith('.xml')
            ) {
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                res.setHeader('Surrogate-Control', 'no-store');
            }
            next();
        });

        // Serve static files
        this.app.use(express.static(this.contentDir));
        
        // Basic root handler
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.contentDir, 'index.html'));
        });

        // Debug route to check path
        this.app.get('/debug-path', (req, res) => {
            res.send(`Serving content from: ${this.contentDir}`);
        });
    }

    public start(): void {
        this.app.listen(this.port, this.host, () => {
            console.log(`[StaticServer] Serving ${this.contentDir} on http://${this.host}:${this.port}`);
            console.log(`[StaticServer] Remote Flash: http://${Config.HOST}/p/cbp/DungeonBlitz.swf`);
        });
    }
}
