import express from 'express';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';

interface DiscordRpcClient {
    on(event: 'ready' | 'disconnected' | 'error', listener: (...args: unknown[]) => void): void;
    login(options: { clientId: string }): Promise<void>;
    setActivity(activity: Record<string, unknown>): Promise<void>;
    clearActivity(): Promise<void>;
}

interface DiscordRpcLibrary {
    register(clientId: string): void;
    Client: new (options: { transport: 'ipc' }) => DiscordRpcClient;
}

interface BridgeConfig {
    appId: string;
    port: number;
    largeImageKey: string;
    largeImageText: string;
    logPayloads: boolean;
}

interface PresencePayload {
    characterName?: string;
    details?: string;
    state?: string;
    startedAtMs?: number;
    partySize?: number;
}

const DEFAULT_PORT = 47631;
const PARTY_MAX_MEMBERS = 4;

function resolveConfigPath(): string {
    const candidates = [
        path.resolve(process.cwd(), 'discord-bridge.config.json'),
        path.resolve(__dirname, '..', 'discord-bridge.config.json'),
        path.resolve(__dirname, '..', '..', 'discord-bridge.config.json')
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return candidates[0];
}

const CONFIG_PATH = resolveConfigPath();

class LocalDiscordBridge {
    private readonly app = express();
    private readonly config: BridgeConfig;
    private client: DiscordRpcClient | null = null;
    private ready = false;
    private lastActivityHash = '';

    constructor(config: BridgeConfig) {
        this.config = config;
        this.app.use(express.json({ limit: '64kb' }));
        this.app.use((req, res, next) => {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            if (req.method === 'OPTIONS') {
                res.status(204).end();
                return;
            }
            next();
        });
        this.setupRoutes();
    }

    async start(): Promise<void> {
        if (!this.config.appId) {
            console.error(`[DiscordBridge] Missing appId in ${CONFIG_PATH}`);
            return;
        }

        let discordRpc: DiscordRpcLibrary;
        try {
            discordRpc = require('discord-rpc') as DiscordRpcLibrary;
        } catch (error) {
            console.error('[DiscordBridge] discord-rpc package is not installed:', error);
            return;
        }

        discordRpc.register(this.config.appId);
        this.client = new discordRpc.Client({ transport: 'ipc' });

        this.client.on('ready', () => {
            this.ready = true;
            console.log('[DiscordBridge] Connected to local Discord client.');
        });

        this.client.on('disconnected', () => {
            this.ready = false;
            this.lastActivityHash = '';
            console.log('[DiscordBridge] Disconnected from local Discord client.');
        });

        this.client.on('error', (error: unknown) => {
            console.error('[DiscordBridge] Discord client error:', error);
        });

        try {
            await this.client.login({ clientId: this.config.appId });
        } catch (error) {
            console.error('[DiscordBridge] Failed to connect to local Discord client:', error);
            return;
        }

        this.app.listen(this.config.port, '127.0.0.1', () => {
            console.log(`[DiscordBridge] Listening on http://127.0.0.1:${this.config.port}`);
        });
    }

    private setupRoutes(): void {
        this.app.get('/healthz', (_req, res) => {
            res.json({
                ok: true,
                ready: this.ready
            });
        });

        this.app.post('/presence', async (req, res) => {
            const payload = this.normalizePayload(req);
            if (!payload) {
                await this.clearActivity();
                res.status(202).json({ ok: true, cleared: true });
                return;
            }

            if (this.config.logPayloads) {
                console.log('[DiscordBridge] Incoming payload:', payload);
            }

            const updated = await this.applyActivity(payload);
            res.status(updated ? 200 : 202).json({ ok: true, updated });
        });

        this.app.post('/clear', async (_req, res) => {
            await this.clearActivity();
            res.json({ ok: true, cleared: true });
        });
    }

    private normalizePayload(req: Request): PresencePayload | null {
        const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
        const clear = Boolean(body.clear);
        if (clear) {
            return null;
        }

        const characterName = String(body.characterName ?? '').trim();
        const details = String(body.details ?? '').trim();
        const state = String(body.state ?? '').trim();
        const startedAtMs = Number(body.startedAtMs ?? 0);
        const partySize = Number(body.partySize ?? 0);

        if (!characterName || !details || !state || !Number.isFinite(startedAtMs) || startedAtMs <= 0) {
            return null;
        }

        return {
            characterName,
            details,
            state,
            startedAtMs,
            partySize: Number.isFinite(partySize) ? Math.max(0, Math.round(partySize)) : 0
        };
    }

    private async applyActivity(payload: PresencePayload): Promise<boolean> {
        if (!this.client || !this.ready) {
            return false;
        }

        const activity: Record<string, unknown> = {
            details: payload.details,
            state: payload.state,
            instance: false,
            startTimestamp: new Date(payload.startedAtMs ?? Date.now())
        };

        if ((payload.partySize ?? 0) > 1) {
            activity.partySize = payload.partySize;
            activity.partyMax = PARTY_MAX_MEMBERS;
        }

        if (this.config.largeImageKey) {
            activity.largeImageKey = this.config.largeImageKey;
            if (this.config.largeImageText) {
                activity.largeImageText = this.config.largeImageText;
            }
        }

        const nextHash = JSON.stringify(activity);
        if (nextHash === this.lastActivityHash) {
            return false;
        }

        try {
            await this.client.setActivity(activity);
            this.lastActivityHash = nextHash;
            console.log(`[DiscordBridge] Presence updated: ${payload.characterName} | ${payload.details} | ${payload.state}`);
            return true;
        } catch (error) {
            console.error('[DiscordBridge] Failed to update activity:', error);
            return false;
        }
    }

    private async clearActivity(): Promise<void> {
        if (!this.client || !this.ready || !this.lastActivityHash) {
            this.lastActivityHash = '';
            return;
        }

        try {
            await this.client.clearActivity();
        } catch (error) {
            console.error('[DiscordBridge] Failed to clear activity:', error);
        } finally {
            this.lastActivityHash = '';
        }
    }
}

function readConfig(): BridgeConfig {
    const defaults: BridgeConfig = {
        appId: '',
        port: DEFAULT_PORT,
        largeImageKey: '',
        largeImageText: 'Dungeon Blitz R',
        logPayloads: false
    };

    if (!fs.existsSync(CONFIG_PATH)) {
        return defaults;
    }

    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Record<string, unknown>;
    return {
        appId: String(raw.appId ?? defaults.appId).trim(),
        port: Number.isFinite(Number(raw.port)) ? Math.max(1, Math.round(Number(raw.port))) : defaults.port,
        largeImageKey: String(raw.largeImageKey ?? defaults.largeImageKey).trim(),
        largeImageText: String(raw.largeImageText ?? defaults.largeImageText).trim(),
        logPayloads: Boolean(raw.logPayloads)
    };
}

async function main(): Promise<void> {
    const bridge = new LocalDiscordBridge(readConfig());
    await bridge.start();
}

void main();
