export class DiscordSocialServerApi {
    private readonly token: string;
    private readonly enabled: boolean;

    constructor() {
        this.token = String(process.env.DISCORD_BOT_TOKEN ?? '').trim();
        this.enabled = this.token.length > 0;
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    public async fetchUserDisplayName(discordUserId: string): Promise<string | null> {
        if (!this.enabled) {
            return null;
        }

        const targetUserId = String(discordUserId ?? '').trim();
        if (!targetUserId) {
            return null;
        }

        try {
            const response = await fetch(`https://discord.com/api/v10/users/${targetUserId}`, {
                headers: {
                    Authorization: `Bot ${this.token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error(
                    `[DiscordSocialServerApi] Failed to fetch Discord user ${targetUserId}: ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`
                );
                return null;
            }

            const parsed = await response.json().catch(() => null) as { global_name?: string | null; username?: string; id?: string } | null;
            const globalName = String(parsed?.global_name ?? '').trim();
            const username = String(parsed?.username ?? '').trim();
            return globalName || username || String(parsed?.id ?? '').trim() || null;
        } catch (error) {
            console.error('[DiscordSocialServerApi] fetchUserDisplayName request failed:', error);
            return null;
        }
    }

    public async sendChannelMessage(channelId: string, content: string): Promise<boolean> {
        if (!this.enabled) {
            console.warn('[DiscordSocialServerApi] DISCORD_BOT_TOKEN is missing; cannot send Discord channel message.');
            return false;
        }

        const targetChannelId = String(channelId ?? '').trim();
        const targetContent = String(content ?? '').trim();
        if (!targetChannelId || !targetContent) {
            return false;
        }

        try {
            const response = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bot ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: targetContent.slice(0, 2000),
                    allowed_mentions: {
                        parse: []
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error(
                    `[DiscordSocialServerApi] Failed to send channel message: ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`
                );
                return false;
            }

            return true;
        } catch (error) {
            console.error('[DiscordSocialServerApi] sendChannelMessage request failed:', error);
            return false;
        }
    }

    public async grantCanLinkLobby(lobbyId: string, userId: string): Promise<boolean> {
        if (!this.enabled) {
            console.warn('[DiscordSocialServerApi] DISCORD_BOT_TOKEN is missing; cannot grant CanLinkLobby.');
            return false;
        }

        const targetLobbyId = String(lobbyId ?? '').trim();
        const targetUserId = String(userId ?? '').trim();
        if (!targetLobbyId || !targetUserId) {
            return false;
        }

        try {
            const response = await fetch(`https://discord.com/api/v10/lobbies/${targetLobbyId}/members/${targetUserId}`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bot ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    flags: 1
                })
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                console.error(
                    `[DiscordSocialServerApi] Failed to grant CanLinkLobby: ${response.status} ${response.statusText}${errorText ? `: ${errorText}` : ''}`
                );
                return false;
            }

            return true;
        } catch (error) {
            console.error('[DiscordSocialServerApi] grantCanLinkLobby request failed:', error);
            return false;
        }
    }
}
