import { Client } from './Client';
import { GlobalState, DungeonRunState } from './GlobalState';
import { LevelConfig } from './LevelConfig';
import { BitBuffer } from '../network/protocol/bitBuffer';
import {
    createDungeonInstanceId,
    getClientLevelScope,
    getLevelScopeKey,
    getScopeLevelInstanceId,
    getScopeLevelName,
    normalizeLevelInstanceId
} from './LevelScope';
import { getPartyIdForClient } from './PartySync';
import { normalizeCharacterKey } from './SocialState';

const AUTHORITY_STATE_KEY = '0^SetDungeonAuthority^DB_DungeonAuthority';
const DUNGEON_RUN_GRACE_MS = 5 * 60 * 1000;

type RunProjection = {
    syncRoomId?: number;
    syncStartedRoomIds?: number[];
    syncQuestTrackerState?: number;
    syncDungeonMissionId?: number;
    syncDungeonMissionState?: number;
    syncDungeonMissionProgress?: number | null;
    syncAnchorStartedAt?: number;
    syncAnchorToken?: number;
    syncAnchorCharacterName?: string;
};

type JoinableRunCandidate = {
    levelInstanceId: string;
    questTrackerState: number;
    startedRoomCount: number;
    currentRoomId: number;
    startedAt: number;
};

export class DungeonRunManager {
    static readonly GRACE_MS = DUNGEON_RUN_GRACE_MS;

    private static isJoinable(run: DungeonRunState, now: number): boolean {
        return run.expiresAt <= 0 || run.expiresAt > now || DungeonRunManager.getActiveScopeClients(run.scopeKey).length > 0;
    }

    private static getCharacterKey(client: Pick<Client, 'character'> | null | undefined): string {
        return normalizeCharacterKey(client?.character?.name);
    }

    private static getPendingEntryPartyId(entry: { character?: { name?: string } } | null | undefined): number {
        const key = normalizeCharacterKey(entry?.character?.name);
        return Number(GlobalState.partyByMember.get(key) ?? 0);
    }

    private static getStartedRoomCount(
        levelName: string,
        startedRoomEvents: Iterable<string> | null | undefined,
        syncStartedRoomIds: number[] | null | undefined
    ): number {
        if (Array.isArray(syncStartedRoomIds)) {
            return syncStartedRoomIds.filter((value) => Number.isFinite(Number(value)) && Number(value) >= 0).length;
        }

        if (!startedRoomEvents) {
            return 0;
        }

        const prefix = `${levelName}:`;
        let count = 0;
        for (const key of startedRoomEvents) {
            if (String(key).startsWith(prefix)) {
                count++;
            }
        }
        return count;
    }

    private static chooseBestCandidate(candidates: JoinableRunCandidate[]): string {
        if (candidates.length === 0) {
            return '';
        }

        candidates.sort((left, right) => {
            if (left.questTrackerState !== right.questTrackerState) {
                return right.questTrackerState - left.questTrackerState;
            }
            if (left.startedRoomCount !== right.startedRoomCount) {
                return right.startedRoomCount - left.startedRoomCount;
            }
            if (left.currentRoomId !== right.currentRoomId) {
                return right.currentRoomId - left.currentRoomId;
            }
            return right.startedAt - left.startedAt;
        });

        return candidates[0]?.levelInstanceId ?? '';
    }

    private static buildAuthorityStatePayload(isAuthority: boolean): Buffer {
        const bb = new BitBuffer(false);
        bb.writeMethod13(AUTHORITY_STATE_KEY);
        bb.writeMethod13(isAuthority ? 'On' : 'Off');
        return bb.toBuffer();
    }

    static getActiveScopeClients(scopeKey: string, excludedToken: number = 0): Client[] {
        if (!scopeKey) {
            return [];
        }

        const clients: Client[] = [];
        for (const session of GlobalState.sessionsByToken.values()) {
            if (
                !session.playerSpawned ||
                session.socket?.destroyed ||
                getClientLevelScope(session) !== scopeKey ||
                (excludedToken > 0 && Number(session.token ?? 0) === excludedToken)
            ) {
                continue;
            }
            clients.push(session);
        }

        return clients;
    }

    private static chooseAuthorityToken(scopeKey: string, preferredToken: number = 0): number {
        const activeClients = DungeonRunManager.getActiveScopeClients(scopeKey);
        if (activeClients.length === 0) {
            return preferredToken > 0 ? preferredToken : 0;
        }

        activeClients.sort((left, right) => {
            const leftEntered = Number(left.worldEnteredAt ?? Number.MAX_SAFE_INTEGER);
            const rightEntered = Number(right.worldEnteredAt ?? Number.MAX_SAFE_INTEGER);
            if (leftEntered !== rightEntered) {
                return leftEntered - rightEntered;
            }
            return Number(left.token ?? Number.MAX_SAFE_INTEGER) - Number(right.token ?? Number.MAX_SAFE_INTEGER);
        });

        return Number(activeClients[0]?.token ?? preferredToken ?? 0);
    }

    private static clearExpiredRunArtifacts(scopeKey: string): void {
        GlobalState.levelEntities.delete(scopeKey);
        GlobalState.levelStateByScope.delete(scopeKey);

        const prefix = `${scopeKey}:`;
        for (const key of Array.from(GlobalState.combatContributions.keys())) {
            if (key.startsWith(prefix)) {
                GlobalState.combatContributions.delete(key);
            }
        }
        for (const key of Array.from(GlobalState.entityLifeNonces.keys())) {
            if (key.startsWith(prefix)) {
                GlobalState.entityLifeNonces.delete(key);
            }
        }
        for (const key of Array.from(GlobalState.entityLastRewardNonces.keys())) {
            if (key.startsWith(prefix)) {
                GlobalState.entityLastRewardNonces.delete(key);
            }
        }
    }

    static cleanupExpiredRuns(now: number = Date.now()): void {
        for (const [scopeKey, run] of Array.from(GlobalState.dungeonRunsByScope.entries())) {
            if (DungeonRunManager.getActiveScopeClients(scopeKey).length > 0) {
                run.expiresAt = 0;
                run.lastActiveAt = now;
                continue;
            }

            if (run.expiresAt > 0 && run.expiresAt <= now) {
                GlobalState.dungeonRunsByScope.delete(scopeKey);
                DungeonRunManager.clearExpiredRunArtifacts(scopeKey);
            }
        }
    }

    static getRun(levelName: string | null | undefined, levelInstanceId: string | null | undefined): DungeonRunState | null {
        const scopeKey = getLevelScopeKey(levelName, levelInstanceId);
        if (!scopeKey) {
            return null;
        }
        return GlobalState.dungeonRunsByScope.get(scopeKey) ?? null;
    }

    static getRunByScope(scopeKey: string | null | undefined): DungeonRunState | null {
        return scopeKey ? GlobalState.dungeonRunsByScope.get(scopeKey) ?? null : null;
    }

    static ensureRun(levelName: string, levelInstanceId: string, seed?: Partial<DungeonRunState>): DungeonRunState {
        const scopeKey = getLevelScopeKey(levelName, levelInstanceId);
        const normalizedLevel = LevelConfig.normalizeLevelName(levelName);
        const normalizedInstanceId = normalizeLevelInstanceId(levelInstanceId);
        const now = Date.now();

        let run = GlobalState.dungeonRunsByScope.get(scopeKey) ?? null;
        if (run) {
            return run;
        }

        run = {
            scopeKey,
            levelName: normalizedLevel || levelName,
            levelInstanceId: normalizedInstanceId,
            authorityToken: Math.max(0, Number(seed?.authorityToken ?? 0)),
            participantKeys: seed?.participantKeys ? new Set(seed.participantKeys) : new Set<string>(),
            claimedCompletionKeys: seed?.claimedCompletionKeys ? new Set(seed.claimedCompletionKeys) : new Set<string>(),
            currentRoomId: Number.isFinite(Number(seed?.currentRoomId)) ? Math.max(0, Math.round(Number(seed?.currentRoomId))) : 0,
            startedRoomIds: seed?.startedRoomIds ? new Set(seed.startedRoomIds) : new Set<number>(),
            questTrackerState: Number.isFinite(Number(seed?.questTrackerState))
                ? Math.max(0, Math.round(Number(seed?.questTrackerState)))
                : 0,
            dungeonMissionId: Number.isFinite(Number(seed?.dungeonMissionId))
                ? Math.max(0, Math.round(Number(seed?.dungeonMissionId)))
                : 0,
            dungeonMissionState: Number.isFinite(Number(seed?.dungeonMissionState))
                ? Math.max(0, Math.round(Number(seed?.dungeonMissionState)))
                : 0,
            dungeonMissionProgress: Number.isFinite(Number(seed?.dungeonMissionProgress))
                ? Math.max(0, Math.round(Number(seed?.dungeonMissionProgress)))
                : null,
            completed: Boolean(seed?.completed),
            createdAt: Number.isFinite(Number(seed?.createdAt)) && Number(seed?.createdAt) > 0
                ? Math.round(Number(seed?.createdAt))
                : now,
            lastActiveAt: Number.isFinite(Number(seed?.lastActiveAt)) && Number(seed?.lastActiveAt) > 0
                ? Math.round(Number(seed?.lastActiveAt))
                : now,
            expiresAt: Number.isFinite(Number(seed?.expiresAt)) && Number(seed?.expiresAt) > 0
                ? Math.round(Number(seed?.expiresAt))
                : 0
        };
        GlobalState.dungeonRunsByScope.set(scopeKey, run);
        return run;
    }

    static resolveLevelInstanceIdForEntry(
        client: Pick<Client, 'character'>,
        targetLevel: string,
        fallbackSeed: number | string,
        preferredLevelInstanceId: string = ''
    ): string {
        const normalizedLevel = LevelConfig.normalizeLevelName(targetLevel);
        if (!normalizedLevel || !LevelConfig.isDungeonLevel(normalizedLevel)) {
            return '';
        }

        DungeonRunManager.cleanupExpiredRuns();

        const preferredInstanceId = normalizeLevelInstanceId(preferredLevelInstanceId);
        if (preferredInstanceId) {
            const preferredScopeKey = getLevelScopeKey(normalizedLevel, preferredInstanceId);
            const preferredRun = GlobalState.dungeonRunsByScope.get(preferredScopeKey);
            if (preferredRun && DungeonRunManager.isJoinable(preferredRun, Date.now())) {
                return preferredInstanceId;
            }
        }

        const partyId = getPartyIdForClient(client);
        if (partyId > 0) {
            const activeCandidates: JoinableRunCandidate[] = [];
            for (const session of GlobalState.sessionsByToken.values()) {
                if (
                    !session.playerSpawned ||
                    LevelConfig.normalizeLevelName(session.currentLevel) !== normalizedLevel ||
                    getPartyIdForClient(session) !== partyId
                ) {
                    continue;
                }

                const candidateInstanceId = normalizeLevelInstanceId(session.levelInstanceId);
                if (!candidateInstanceId) {
                    continue;
                }

                const candidateRun = DungeonRunManager.getRun(normalizedLevel, candidateInstanceId);
                if (!candidateRun || DungeonRunManager.isJoinable(candidateRun, Date.now())) {
                    activeCandidates.push({
                        levelInstanceId: candidateInstanceId,
                        questTrackerState: Math.max(
                            0,
                            Number(candidateRun?.questTrackerState ?? session.syncedQuestTrackerState ?? session.character?.questTrackerState ?? 0)
                        ),
                        startedRoomCount: candidateRun?.startedRoomIds?.size ?? DungeonRunManager.getStartedRoomCount(
                            normalizedLevel,
                            session.startedRoomEvents,
                            null
                        ),
                        currentRoomId: Math.max(0, Number(candidateRun?.currentRoomId ?? session.currentRoomId ?? 0)),
                        startedAt: Math.max(
                            0,
                            Number(candidateRun?.createdAt ?? session.syncAnchorStartedAt ?? session.worldEnteredAt ?? 0)
                        )
                    });
                }
            }
            const bestActiveCandidate = DungeonRunManager.chooseBestCandidate(activeCandidates);
            if (bestActiveCandidate) {
                return bestActiveCandidate;
            }

            const pendingCandidates: JoinableRunCandidate[] = [];
            for (const entry of GlobalState.pendingWorld.values()) {
                if (
                    LevelConfig.normalizeLevelName(entry.targetLevel) !== normalizedLevel ||
                    DungeonRunManager.getPendingEntryPartyId(entry) !== partyId
                ) {
                    continue;
                }

                const candidateInstanceId = normalizeLevelInstanceId(entry.levelInstanceId);
                if (!candidateInstanceId) {
                    continue;
                }

                const candidateRun = DungeonRunManager.getRun(normalizedLevel, candidateInstanceId);
                if (!candidateRun || DungeonRunManager.isJoinable(candidateRun, Date.now())) {
                    pendingCandidates.push({
                        levelInstanceId: candidateInstanceId,
                        questTrackerState: Math.max(
                            0,
                            Number(candidateRun?.questTrackerState ?? entry.syncQuestTrackerState ?? entry.character?.questTrackerState ?? 0)
                        ),
                        startedRoomCount: candidateRun?.startedRoomIds?.size ?? DungeonRunManager.getStartedRoomCount(
                            normalizedLevel,
                            null,
                            entry.syncStartedRoomIds
                        ),
                        currentRoomId: Math.max(0, Number(candidateRun?.currentRoomId ?? entry.syncRoomId ?? 0)),
                        startedAt: Math.max(0, Number(candidateRun?.createdAt ?? entry.syncAnchorStartedAt ?? 0))
                    });
                }
            }
            const bestPendingCandidate = DungeonRunManager.chooseBestCandidate(pendingCandidates);
            if (bestPendingCandidate) {
                return bestPendingCandidate;
            }
        }

        const characterKey = DungeonRunManager.getCharacterKey(client);
        if (characterKey) {
            for (const run of GlobalState.dungeonRunsByScope.values()) {
                if (
                    run.levelName !== normalizedLevel ||
                    !run.participantKeys.has(characterKey) ||
                    !DungeonRunManager.isJoinable(run, Date.now())
                ) {
                    continue;
                }

                return run.levelInstanceId;
            }
        }

        return createDungeonInstanceId(fallbackSeed);
    }

    static buildRunProjection(levelName: string, levelInstanceId: string): RunProjection | null {
        const run = DungeonRunManager.getRun(levelName, levelInstanceId);
        if (!run) {
            return null;
        }

        const authoritySession = run.authorityToken > 0
            ? GlobalState.sessionsByToken.get(run.authorityToken) ?? null
            : null;
        return {
            syncRoomId: run.currentRoomId,
            syncStartedRoomIds: Array.from(run.startedRoomIds.values()).sort((left, right) => left - right),
            syncQuestTrackerState: run.questTrackerState,
            syncDungeonMissionId: run.dungeonMissionId || undefined,
            syncDungeonMissionState: run.dungeonMissionState || undefined,
            syncDungeonMissionProgress: run.dungeonMissionProgress,
            syncAnchorStartedAt: run.createdAt,
            syncAnchorToken: run.authorityToken || undefined,
            syncAnchorCharacterName: authoritySession?.character?.name || undefined
        };
    }

    static syncClientProjection(client: Client, run: DungeonRunState | null = null): DungeonRunState | null {
        const activeRun = run ?? DungeonRunManager.getRun(client.currentLevel, client.levelInstanceId);
        if (!activeRun || !client.currentLevel) {
            return null;
        }

        client.currentRoomId = Math.max(0, Number(activeRun.currentRoomId ?? 0));
        for (const key of Array.from(client.startedRoomEvents.values())) {
            if (key.startsWith(`${client.currentLevel}:`)) {
                client.startedRoomEvents.delete(key);
            }
        }
        for (const roomId of Array.from(activeRun.startedRoomIds.values()).sort((left, right) => left - right)) {
            client.startedRoomEvents.add(`${client.currentLevel}:${roomId}`);
        }

        client.syncedQuestTrackerState = Math.max(0, Number(activeRun.questTrackerState ?? 0));
        client.syncedDungeonMissionId = Math.max(0, Number(activeRun.dungeonMissionId ?? 0));
        client.syncedDungeonMissionState = Math.max(0, Number(activeRun.dungeonMissionState ?? 0));
        client.syncedDungeonMissionProgress = Number.isFinite(Number(activeRun.dungeonMissionProgress))
            ? Math.max(0, Math.round(Number(activeRun.dungeonMissionProgress)))
            : null;
        client.syncAnchorStartedAt = Math.max(0, Number(activeRun.createdAt ?? 0));
        client.syncAnchorToken = Math.max(0, Number(activeRun.authorityToken ?? 0));
        client.syncAnchorCharacterName = String(
            GlobalState.sessionsByToken.get(activeRun.authorityToken)?.character?.name ??
            client.syncAnchorCharacterName ??
            ''
        ).trim();
        return activeRun;
    }

    static seedRunFromClient(client: Pick<Client, 'currentLevel' | 'levelInstanceId' | 'currentRoomId' | 'startedRoomEvents' | 'syncedQuestTrackerState' | 'syncedDungeonMissionId' | 'syncedDungeonMissionState' | 'syncedDungeonMissionProgress'>): DungeonRunState | null {
        const levelName = LevelConfig.normalizeLevelName(client.currentLevel);
        const levelInstanceId = normalizeLevelInstanceId(client.levelInstanceId);
        if (!levelName || !levelInstanceId || !LevelConfig.isDungeonLevel(levelName)) {
            return null;
        }

        const run = DungeonRunManager.ensureRun(levelName, levelInstanceId);
        run.currentRoomId = Math.max(run.currentRoomId, Math.max(0, Number(client.currentRoomId ?? 0)));
        for (const key of client.startedRoomEvents) {
            const prefix = `${levelName}:`;
            if (!key.startsWith(prefix)) {
                continue;
            }

            const roomId = Number(key.substring(prefix.length));
            if (Number.isFinite(roomId) && roomId >= 0) {
                run.startedRoomIds.add(Math.round(roomId));
            }
        }

        const questTrackerState = Number(client.syncedQuestTrackerState);
        if (Number.isFinite(questTrackerState) && questTrackerState >= 0) {
            run.questTrackerState = Math.max(run.questTrackerState, Math.round(questTrackerState));
        }

        const missionId = Number(client.syncedDungeonMissionId);
        if (Number.isFinite(missionId) && missionId > 0) {
            run.dungeonMissionId = Math.round(missionId);
        }
        const missionState = Number(client.syncedDungeonMissionState);
        if (Number.isFinite(missionState) && missionState > 0) {
            run.dungeonMissionState = Math.round(missionState);
        }
        const missionProgress = Number(client.syncedDungeonMissionProgress);
        if (Number.isFinite(missionProgress) && missionProgress >= 0) {
            run.dungeonMissionProgress = Math.max(0, Math.round(missionProgress));
        }

        run.completed = run.completed || run.questTrackerState >= 100;
        run.lastActiveAt = Date.now();
        return run;
    }

    static attachClient(client: Client): DungeonRunState | null {
        const levelName = LevelConfig.normalizeLevelName(client.currentLevel);
        const levelInstanceId = normalizeLevelInstanceId(client.levelInstanceId);
        if (!levelName || !levelInstanceId || !LevelConfig.isDungeonLevel(levelName)) {
            return null;
        }

        DungeonRunManager.cleanupExpiredRuns();

        const run = DungeonRunManager.ensureRun(levelName, levelInstanceId, {
            authorityToken: Math.max(0, Number(client.syncAnchorToken ?? 0)),
            currentRoomId: Math.max(0, Number(client.currentRoomId ?? 0)),
            questTrackerState: Math.max(0, Number(client.syncedQuestTrackerState ?? client.character?.questTrackerState ?? 0)),
            dungeonMissionId: Math.max(0, Number(client.syncedDungeonMissionId ?? 0)),
            dungeonMissionState: Math.max(0, Number(client.syncedDungeonMissionState ?? 0)),
            dungeonMissionProgress: client.syncedDungeonMissionProgress
        });
        const characterKey = DungeonRunManager.getCharacterKey(client);
        if (characterKey) {
            run.participantKeys.add(characterKey);
        }

        DungeonRunManager.seedRunFromClient(client);
        run.lastActiveAt = Date.now();
        run.expiresAt = 0;

        const currentAuthority = run.authorityToken > 0
            ? GlobalState.sessionsByToken.get(run.authorityToken) ?? null
            : null;
        if (!currentAuthority || currentAuthority.socket?.destroyed || getClientLevelScope(currentAuthority) !== run.scopeKey) {
            run.authorityToken = client.token > 0 ? client.token : DungeonRunManager.chooseAuthorityToken(run.scopeKey);
        }

        DungeonRunManager.syncClientProjection(client, run);
        return run;
    }

    static detachClient(client: Pick<Client, 'token' | 'currentLevel' | 'levelInstanceId'>): DungeonRunState | null {
        const levelName = LevelConfig.normalizeLevelName(client.currentLevel);
        const levelInstanceId = normalizeLevelInstanceId(client.levelInstanceId);
        if (!levelName || !levelInstanceId || !LevelConfig.isDungeonLevel(levelName)) {
            return null;
        }

        const run = DungeonRunManager.getRun(levelName, levelInstanceId);
        if (!run) {
            return null;
        }

        run.lastActiveAt = Date.now();
        const nextAuthority = DungeonRunManager.getActiveScopeClients(run.scopeKey, Number(client.token ?? 0))
            .sort((left, right) => {
                const leftEntered = Number(left.worldEnteredAt ?? Number.MAX_SAFE_INTEGER);
                const rightEntered = Number(right.worldEnteredAt ?? Number.MAX_SAFE_INTEGER);
                if (leftEntered !== rightEntered) {
                    return leftEntered - rightEntered;
                }
                return Number(left.token ?? Number.MAX_SAFE_INTEGER) - Number(right.token ?? Number.MAX_SAFE_INTEGER);
            })[0]?.token ?? 0;
        if (nextAuthority > 0) {
            run.authorityToken = Math.round(Number(nextAuthority));
            run.expiresAt = 0;
        } else {
            run.authorityToken = 0;
            run.expiresAt = Date.now() + DungeonRunManager.GRACE_MS;
        }

        return run;
    }

    static sendAuthorityState(client: Pick<Client, 'send' | 'currentLevel' | 'levelInstanceId' | 'token'>): void {
        const run = DungeonRunManager.getRun(client.currentLevel, client.levelInstanceId);
        if (!run) {
            return;
        }

        const payload = DungeonRunManager.buildAuthorityStatePayload(run.authorityToken > 0 && run.authorityToken === Number(client.token ?? 0));
        client.send(0x40, payload);
    }

    static broadcastAuthorityState(levelName: string, levelInstanceId: string): void {
        const run = DungeonRunManager.getRun(levelName, levelInstanceId);
        if (!run) {
            return;
        }

        for (const other of GlobalState.sessionsByToken.values()) {
            if (getClientLevelScope(other) !== run.scopeKey || other.socket?.destroyed) {
                continue;
            }
            DungeonRunManager.sendAuthorityState(other);
        }
    }

    static noteRoomEvent(client: Pick<Client, 'currentLevel' | 'levelInstanceId'>, roomId: number, started: boolean = true): DungeonRunState | null {
        const run = DungeonRunManager.getRun(client.currentLevel, client.levelInstanceId);
        if (!run || !Number.isFinite(Number(roomId)) || Number(roomId) < 0) {
            return null;
        }

        run.currentRoomId = Math.max(0, Math.round(Number(roomId)));
        if (started) {
            run.startedRoomIds.add(run.currentRoomId);
        }
        run.lastActiveAt = Date.now();
        return run;
    }

    static noteQuestProgress(client: Pick<Client, 'currentLevel' | 'levelInstanceId'>, progress: number): DungeonRunState | null {
        const run = DungeonRunManager.getRun(client.currentLevel, client.levelInstanceId);
        if (!run || !Number.isFinite(Number(progress))) {
            return null;
        }

        run.questTrackerState = Math.max(0, Math.round(Number(progress)));
        run.completed = run.completed || run.questTrackerState >= 100;
        run.lastActiveAt = Date.now();
        return run;
    }

    static noteDungeonMissionSync(
        client: Pick<Client, 'currentLevel' | 'levelInstanceId'>,
        missionId: number,
        missionState: number,
        missionProgress: number | null | undefined
    ): DungeonRunState | null {
        const run = DungeonRunManager.getRun(client.currentLevel, client.levelInstanceId);
        if (!run) {
            return null;
        }

        if (Number.isFinite(Number(missionId)) && Number(missionId) > 0) {
            run.dungeonMissionId = Math.max(0, Math.round(Number(missionId)));
        }
        if (Number.isFinite(Number(missionState)) && Number(missionState) >= 0) {
            run.dungeonMissionState = Math.max(0, Math.round(Number(missionState)));
        }
        if (Number.isFinite(Number(missionProgress)) && Number(missionProgress) >= 0) {
            run.dungeonMissionProgress = Math.max(0, Math.round(Number(missionProgress)));
        }
        run.lastActiveAt = Date.now();
        return run;
    }

    static markCompleted(client: Pick<Client, 'currentLevel' | 'levelInstanceId'>): DungeonRunState | null {
        const run = DungeonRunManager.getRun(client.currentLevel, client.levelInstanceId);
        if (!run) {
            return null;
        }

        run.completed = true;
        run.questTrackerState = Math.max(100, run.questTrackerState);
        run.lastActiveAt = Date.now();
        return run;
    }

    static hasClaimedCompletion(run: DungeonRunState | null | undefined, characterName: string | null | undefined): boolean {
        const key = normalizeCharacterKey(characterName);
        return Boolean(run && key && run.claimedCompletionKeys.has(key));
    }

    static markCompletionClaimed(run: DungeonRunState | null | undefined, characterName: string | null | undefined): void {
        const key = normalizeCharacterKey(characterName);
        if (!run || !key) {
            return;
        }

        run.claimedCompletionKeys.add(key);
        run.lastActiveAt = Date.now();
    }

    static debugDescribeRun(scopeKey: string): string {
        const run = GlobalState.dungeonRunsByScope.get(scopeKey);
        if (!run) {
            return '(none)';
        }

        return `${getScopeLevelName(scopeKey)}#${getScopeLevelInstanceId(scopeKey)} authority=${run.authorityToken} rooms=${Array.from(run.startedRoomIds.values()).sort((left, right) => left - right).join(',')}`;
    }
}
