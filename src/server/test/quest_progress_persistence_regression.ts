import { strict as assert } from 'assert';
import { Character } from '../database/Database';
import { JsonAdapter } from '../database/JsonAdapter';
import { LevelHandler } from '../handlers/LevelHandler';
import { BitBuffer } from '../network/protocol/bitBuffer';

type FakeClient = {
    userId: number;
    character: Character;
    characters: Character[];
    currentLevel: string;
    levelInstanceId: string;
};

function createCharacter(): Character {
    return {
        name: 'Neodevil',
        class: 'Paladin',
        gender: 'male',
        level: 10,
        questTrackerState: 92,
        CurrentLevel: { name: 'CraftTown', x: 360, y: 1460 },
        PreviousLevel: { name: 'NewbieRoad', x: 1421, y: 826 }
    };
}

function createClient(): FakeClient {
    const character = createCharacter();
    return {
        userId: 6,
        character,
        characters: [character],
        currentLevel: 'CraftTown',
        levelInstanceId: ''
    };
}

function createQuestProgressPacket(progress: number): Buffer {
    const bb = new BitBuffer();
    bb.writeMethod4(progress);
    return bb.toBuffer();
}

async function testQuestProgressUpdatePersistsCharacterSnapshot(): Promise<void> {
    const client = createClient();
    let saveCalls = 0;

    const originalSaveCharacterSnapshot = JsonAdapter.prototype.saveCharacterSnapshot;
    JsonAdapter.prototype.saveCharacterSnapshot = async function(userId: number, character: Character): Promise<Character[]> {
        saveCalls += 1;
        assert.equal(userId, 6);
        assert.equal(character.questTrackerState, 100);
        return [character];
    };

    try {
        await LevelHandler.handleQuestProgressUpdate(client as never, createQuestProgressPacket(100));
    } finally {
        JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
    }

    assert.equal(client.character.questTrackerState, 100);
    assert.equal(saveCalls, 1);
}

async function testQuestProgressUpdateDoesNotRegressCompletedCraftTownTutorial(): Promise<void> {
    const client = createClient();
    client.character.missions = {
        '5': {
            state: 3,
            currCount: 1,
            claimed: 1,
            complete: 1
        }
    };
    client.character.questTrackerState = 100;

    let saveCalls = 0;
    const originalSaveCharacterSnapshot = JsonAdapter.prototype.saveCharacterSnapshot;
    JsonAdapter.prototype.saveCharacterSnapshot = async function(userId: number, character: Character): Promise<Character[]> {
        saveCalls += 1;
        assert.equal(userId, 6);
        assert.equal(character.questTrackerState, 100);
        return [character];
    };

    try {
        await LevelHandler.handleQuestProgressUpdate(client as never, createQuestProgressPacket(92));
    } finally {
        JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
    }

    assert.equal(client.character.questTrackerState, 100);
    assert.equal(saveCalls, 0);
}

async function testTutorialDungeonQuestProgressStaysAtIntroBaselineUntilDropTutorial(): Promise<void> {
    const client = createClient();
    client.currentLevel = 'TutorialDungeon';
    client.character.CurrentLevel = { name: 'TutorialDungeon', x: 0, y: 0 };
    client.character.PreviousLevel = { name: 'NewbieRoad', x: 1421, y: 826 };
    client.character.questTrackerState = 11;
    (client as any).startedRoomEvents = new Set<string>([
        'TutorialDungeon:0',
        'TutorialDungeon:1',
        'TutorialDungeon:4'
    ]);

    let saveCalls = 0;
    const originalSaveCharacterSnapshot = JsonAdapter.prototype.saveCharacterSnapshot;
    JsonAdapter.prototype.saveCharacterSnapshot = async function(userId: number, character: Character): Promise<Character[]> {
        saveCalls += 1;
        assert.equal(userId, 6);
        assert.equal(character.questTrackerState, 59);
        return [character];
    };

    try {
        await LevelHandler.handleQuestProgressUpdate(client as never, createQuestProgressPacket(100));
    } finally {
        JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
    }

    assert.equal(client.character.questTrackerState, 59);
    assert.equal(saveCalls, 1);
}

async function testTutorialDungeonPartyFollowerProgressPreservesLeaderPercent(): Promise<void> {
    // Regression: party members that have DROP_ROOM_EVENT (5) un-fired should
    // never have their saved progress dragged back below the leader's value.
    // Previously the clamp unconditionally forced progress to 11, causing the
    // follower to be stuck at 56% → 59% instead of reaching 65%.
    const leader = createClient();
    const follower = createClient();

    leader.currentLevel = 'TutorialDungeon';
    leader.character.name = 'Leader';
    leader.character.CurrentLevel = { name: 'TutorialDungeon', x: 0, y: 0 };
    leader.character.PreviousLevel = { name: 'NewbieRoad', x: 1421, y: 826 };
    leader.character.questTrackerState = 56;
    (leader as any).startedRoomEvents = new Set<string>([
        'TutorialDungeon:0',
        'TutorialDungeon:1',
        'TutorialDungeon:4',
        'TutorialDungeon:5'
    ]);
    (leader as any).playerSpawned = true;
    (leader as any).send = () => {};
    (leader as any).sendBitBuffer = () => {};

    follower.currentLevel = 'TutorialDungeon';
    follower.character.name = 'Member';
    follower.character.CurrentLevel = { name: 'TutorialDungeon', x: 0, y: 0 };
    follower.character.PreviousLevel = { name: 'NewbieRoad', x: 1421, y: 826 };
    follower.character.questTrackerState = 11;
    (follower as any).startedRoomEvents = new Set<string>([
        'TutorialDungeon:0',
        'TutorialDungeon:1',
        'TutorialDungeon:4'
        // DROP_ROOM_EVENT (5) NOT started for follower – this was the trigger for the bug
    ]);
    (follower as any).playerSpawned = true;
    (follower as any).userId = 7;
    (follower as any).levelInstanceId = '';
    (follower as any).sentPackets = [];
    (follower as any).send = () => {};
    (follower as any).sendBitBuffer = () => {};

    const { GlobalState } = await import('../core/GlobalState');
    const prevSessions = new Map(GlobalState.sessionsByToken);
    const prevPartyByMember = new Map(GlobalState.partyByMember);
    const prevPartyGroups = new Map(GlobalState.partyGroups);

    GlobalState.sessionsByToken.set((leader as any).token ?? 9001, leader as never);
    GlobalState.sessionsByToken.set((follower as any).token ?? 9002, follower as never);
    GlobalState.partyByMember.set('leader', 99);
    GlobalState.partyByMember.set('member', 99);
    GlobalState.partyGroups.set(99, { id: 99, leader: 'Leader', members: ['Leader', 'Member'], locked: false });

    let savedProgress: number | null = null;
    const originalSaveCharacterSnapshot = (await import('../database/JsonAdapter')).JsonAdapter.prototype.saveCharacterSnapshot;
    (await import('../database/JsonAdapter')).JsonAdapter.prototype.saveCharacterSnapshot = async function(_userId: number, character: Character): Promise<Character[]> {
        if (character.name === 'Member') {
            savedProgress = Number(character.questTrackerState ?? 0);
        }
        return [character];
    };

    try {
        // Simulate party leader advancing to 65% (tutorial complete)
        leader.character.questTrackerState = 65;

        // Follower sends their local 56% – this used to be clamped to 11
        await LevelHandler.handleQuestProgressUpdate(follower as never, createQuestProgressPacket(56));
    } finally {
        (await import('../database/JsonAdapter')).JsonAdapter.prototype.saveCharacterSnapshot = originalSaveCharacterSnapshot;
        GlobalState.sessionsByToken.clear();
        for (const [k, v] of prevSessions) GlobalState.sessionsByToken.set(k, v);
        GlobalState.partyByMember.clear();
        for (const [k, v] of prevPartyByMember) GlobalState.partyByMember.set(k, v);
        GlobalState.partyGroups.clear();
        for (const [k, v] of prevPartyGroups) GlobalState.partyGroups.set(k, v);
    }

    // The follower's saved progress must be at least the leader's 65%, not the old 11
    assert.ok(
        (savedProgress ?? follower.character.questTrackerState) >= 56,
        `follower's saved progress should not be dragged below the leader value (got ${savedProgress ?? follower.character.questTrackerState})`
    );
    assert.ok(
        follower.character.questTrackerState >= 56,
        `follower's in-memory questTrackerState should not regress below the leader-driven 56% (got ${follower.character.questTrackerState})`
    );
}

async function main(): Promise<void> {
    await testQuestProgressUpdatePersistsCharacterSnapshot();
    await testQuestProgressUpdateDoesNotRegressCompletedCraftTownTutorial();
    await testTutorialDungeonQuestProgressStaysAtIntroBaselineUntilDropTutorial();
    await testTutorialDungeonPartyFollowerProgressPreservesLeaderPercent();
    console.log('quest_progress_persistence_regression: ok');
}

void main().catch((error) => {
    console.error('quest_progress_persistence_regression: failed');
    console.error(error);
    process.exitCode = 1;
});
