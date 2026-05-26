import * as zlib from 'zlib';
import {
    applyPatchesToBody,
    classIndexByName,
    disassemble,
    methodIdxForTrait,
    parseAbc,
    parseSwf,
    u30OperandName,
    writeU30
} from '../scripts/swfPatchUtils';
import { Config } from './config';

export type DungeonBlitzSwfMode = 'local' | 'multiplayer';
export type DungeonBlitzSwfLocale = 'en' | 'tr';

const LOCAL_HOST = 'localhost';
const REMOTE_HOST = Config.MULTIPLAYER_HOST;
const LOCAL_ASSET_PATH = ':8000/p/';
const REMOTE_ASSET_PATH = '/p/';
const OLD_LOCAL_REFRESH_URL = 'http://localhost:8000/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp';
const OLD_LOCAL_REFRESH_URL_LEGACY = 'http://localhost/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp';
const OLD_REMOTE_REFRESH_URL = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp`;
const OLD_REMOTE_REFRESH_URL_LEGACY = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp`;
const PREVIOUS_LOCAL_REFRESH_URL = 'http://localhost:8000/p/cbp/DungeonBlitz.swf?fv=cbu&gv=cbt';
const PREVIOUS_LOCAL_REFRESH_URL_LEGACY = 'http://localhost/p/cbp/DungeonBlitz.swf?fv=cbu&gv=cbt';
const PREVIOUS_REMOTE_REFRESH_URL = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbu&gv=cbt`;
const PREVIOUS_REMOTE_REFRESH_URL_LEGACY = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbu&gv=cbt`;
const CURRENT_PREVIOUS_LOCAL_REFRESH_URL = 'http://localhost:8000/p/cbp/DungeonBlitz.swf?fv=cbv&gv=cbu';
const CURRENT_PREVIOUS_LOCAL_REFRESH_URL_LEGACY = 'http://localhost/p/cbp/DungeonBlitz.swf?fv=cbv&gv=cbu';
const CURRENT_PREVIOUS_REMOTE_REFRESH_URL = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbv&gv=cbu`;
const CURRENT_PREVIOUS_REMOTE_REFRESH_URL_LEGACY = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbv&gv=cbu`;
const LOCAL_REFRESH_URL = 'http://localhost:8000/p/cbp/DungeonBlitz.swf?fv=cbw&gv=cbv';
const LOCAL_REFRESH_URL_LEGACY = 'http://localhost/p/cbp/DungeonBlitz.swf?fv=cbw&gv=cbv';
const REMOTE_REFRESH_URL = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbw&gv=cbv`;
const REMOTE_REFRESH_URL_LEGACY = `http://${REMOTE_HOST}/p/cbp/DungeonBlitz.swf?fv=cbw&gv=cbv`;
const MOUNT_SPEED_PATCH_CLASS = 'CombatState';
const MOUNT_SPEED_PATCH_METHOD = 'method_960';
const MOUNT_SPEED_DUNGEON_FLAG = 'bInstanced';
const HP_ADJUST_PATCH_CLASS = 'LinkUpdater';
const HP_ADJUST_PATCH_METHOD = 'method_3000';
const ENTITY_INCREMENTAL_PATCH_CLASS = 'LinkUpdater';
const ENTITY_INCREMENTAL_PATCH_METHOD = 'method_1072';

type StringReplacement = {
    oldValue: string;
    newValue: string;
};

const TURKISH_DISCIPLINE_REPLACEMENTS: StringReplacement[] = [
    {
        oldValue: 'Blessed by the Storm Gods, you draw enemy wrath upon your impregnable form and focus the tempest until you become the Lightning Avatar and smite all who stand before you.',
        newValue: 'Firtina Tanrilari tarafindan kutsanmis olarak dusmanlarin ofkesini sarsilmaz bedenine cekersin; firtinayi odaklayip Simsek Avatarina donusur, karsina cikan herkesi cezalandirirsin.'
    },
    {
        oldValue: 'With righteous fury from the Flame of Justice coursing through your body, you leap into the fray, a blaze of attacks swirling through the enemy ranks.',
        newValue: 'Adalet Alevi bedeninde dolasan hakli ofkeyle savasa atlarsin; dusman saflarinin icinde alevli saldirilarla donersin.'
    },
    {
        oldValue: 'Infused with the Numinous Essence, you shine a searing, sacred light into the darkest places, healing the worthy and inflicting blinding agony upon the wicked.',
        newValue: 'Numinous Oz ile dolarak en karanlik yerlere yakici kutsal isik sacarsin; layik olanlari iyilestirir, kotulere kor edici aci verirsin.'
    },
    {
        oldValue: 'You have forsaken all safety for the Pure Death; you know the perfect strike, the incurable venom, the hidden cut that dooms your chosen foe to certain annihilation.',
        newValue: 'Saf Olum ugruna tum guvenligi biraktin; kusursuz darbeyi, caresiz zehri ve sectigin dusmani kesin yok olusa goturen gizli kesigi bilirsin.'
    },
    {
        oldValue: 'You have sacrificed yourself to the Shadow Court, becoming a deadly trickster who strikes from afar, appears everywhere at once, and terrorizes enemies from the darkness.',
        newValue: 'Kendini Golge Sarayi\'na adadin; uzaktan vuran, ayni anda her yerde beliren ve karanliktan dusmanlara dehset salan olumcul bir hilekara donustun.'
    },
    {
        oldValue: 'You have mastered the heresies of the Codex Carnifex; you know that true pain comes with the death of the soul and that true victory takes a foe’s life force as your dark reward.',
        newValue: 'Codex Carnifex\'in sapkin ogretilerinde ustalastin; gercek acinin ruhun olumunden geldigini ve gercek zaferin dusmanin yasam gucunu karanlik odul olarak almak oldugunu bilirsin.'
    },
    {
        oldValue: 'Touched by an Essence of Fire, you throw caution to the wind with every explosive inferno you unleash upon the enemy, incinerating all but leaving you vulnerable among the ashes.',
        newValue: 'Ates Ozunun dokundugu biri olarak, saldigin her patlayici cehennemle tedbiri elden birakirsin; dusmani yakip kul eder ama kullerin arasinda savunmasiz kalirsin.'
    },
    {
        oldValue: 'Channeling the Eternal Winter, your icy conjurations keep the enemy hordes at bay and protect you from harm while a frozen doom descends upon all who oppose you.',
        newValue: 'Ebedi Kisi kanalize ederek buzlu yaratilimlarinla dusman surulerini uzakta tutar, sana zarar gelmesini onlersin; karsi koyanlarin uzerine donmus bir son coker.'
    },
    {
        oldValue: 'Tainted by the Curse of Undeath, you fear no foe, raising armies of hungry ghouls to feast upon your unfortunate enemies, your own power and immortal essence grows with every victim they claim.',
        newValue: 'Olumsuzluk Lanetiyle lekelenmis olarak hicbir dusmandan korkmazsin; talihsiz dusmanlarina saldirdigin ac gulyabani ordulari kurarsin ve aldiklari her kurbanla gucun ve olumsuz ozun buyur.'
    },
    { oldValue: 'Wizardry Guild', newValue: 'Buyuculuk Loncasi' },
    { oldValue: 'Winter Order', newValue: 'Kis Tarikati' },
    { oldValue: 'Infernal Circle', newValue: 'Cehennem Cemberi' },
    { oldValue: 'Accursed Coven', newValue: 'Lanetli Meclis' },
    { oldValue: 'Tricks o’ Trade', newValue: 'Meslegin Hileleri' },
    { oldValue: 'Ambush & Onslaught', newValue: 'Pusu ve Taarruz' },
    { oldValue: 'From the Shadows', newValue: 'Golgelerden' },
    { oldValue: 'The Dark Arts', newValue: 'Kara Sanatlar' },
    { oldValue: 'Martial Techniques', newValue: 'Savas Teknikleri' },
    { oldValue: 'Chivalric Prowess', newValue: 'Sovalye Mahareti' },
    { oldValue: 'Sacred Castigations', newValue: 'Kutsal Cezalar' },
    { oldValue: 'Theurgical Devotions', newValue: 'Ilahi Adanmalar' },
    { oldValue: 'Discipline Masteries', newValue: 'Disiplin Ustaligi' }
];

// The original SWF had English disconnect strings ("Lost Connection", "Client
// Error") but they were overwritten with Turkish ("Baglanti Koptu", "Istemci
// Hatasi") directly in the string pool, so every locale sees Turkish text.
const DISCONNECT_SCREEN_RESTORE_ENGLISH: StringReplacement[] = [
    { oldValue: 'Baglanti Koptu', newValue: 'Lost Connection' },
    { oldValue: 'Istemci Hatasi', newValue: 'Client Error' },
];

function getReplacements(mode: DungeonBlitzSwfMode, locale: DungeonBlitzSwfLocale): StringReplacement[] {
    const localeReplacements = locale === 'tr'
        ? TURKISH_DISCIPLINE_REPLACEMENTS
        : DISCONNECT_SCREEN_RESTORE_ENGLISH;
    if (mode === 'local') {
        return [
            { oldValue: REMOTE_HOST, newValue: LOCAL_HOST },
            { oldValue: REMOTE_ASSET_PATH, newValue: LOCAL_ASSET_PATH },
            { oldValue: OLD_REMOTE_REFRESH_URL, newValue: LOCAL_REFRESH_URL },
            { oldValue: OLD_REMOTE_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            { oldValue: OLD_LOCAL_REFRESH_URL, newValue: LOCAL_REFRESH_URL },
            { oldValue: OLD_LOCAL_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            { oldValue: PREVIOUS_REMOTE_REFRESH_URL, newValue: LOCAL_REFRESH_URL },
            { oldValue: PREVIOUS_REMOTE_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            { oldValue: PREVIOUS_LOCAL_REFRESH_URL, newValue: LOCAL_REFRESH_URL },
            { oldValue: PREVIOUS_LOCAL_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            { oldValue: CURRENT_PREVIOUS_REMOTE_REFRESH_URL, newValue: LOCAL_REFRESH_URL },
            { oldValue: CURRENT_PREVIOUS_REMOTE_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            { oldValue: CURRENT_PREVIOUS_LOCAL_REFRESH_URL, newValue: LOCAL_REFRESH_URL },
            { oldValue: CURRENT_PREVIOUS_LOCAL_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            { oldValue: REMOTE_REFRESH_URL, newValue: LOCAL_REFRESH_URL },
            { oldValue: REMOTE_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            { oldValue: LOCAL_REFRESH_URL_LEGACY, newValue: LOCAL_REFRESH_URL },
            ...localeReplacements
        ];
    }

    return [
        { oldValue: LOCAL_HOST, newValue: REMOTE_HOST },
        { oldValue: LOCAL_ASSET_PATH, newValue: REMOTE_ASSET_PATH },
        { oldValue: OLD_LOCAL_REFRESH_URL, newValue: REMOTE_REFRESH_URL },
        { oldValue: OLD_LOCAL_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        { oldValue: OLD_REMOTE_REFRESH_URL, newValue: REMOTE_REFRESH_URL },
        { oldValue: OLD_REMOTE_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        { oldValue: PREVIOUS_LOCAL_REFRESH_URL, newValue: REMOTE_REFRESH_URL },
        { oldValue: PREVIOUS_LOCAL_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        { oldValue: PREVIOUS_REMOTE_REFRESH_URL, newValue: REMOTE_REFRESH_URL },
        { oldValue: PREVIOUS_REMOTE_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        { oldValue: CURRENT_PREVIOUS_LOCAL_REFRESH_URL, newValue: REMOTE_REFRESH_URL },
        { oldValue: CURRENT_PREVIOUS_LOCAL_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        { oldValue: CURRENT_PREVIOUS_REMOTE_REFRESH_URL, newValue: REMOTE_REFRESH_URL },
        { oldValue: CURRENT_PREVIOUS_REMOTE_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        { oldValue: LOCAL_REFRESH_URL, newValue: REMOTE_REFRESH_URL },
        { oldValue: REMOTE_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        { oldValue: LOCAL_REFRESH_URL_LEGACY, newValue: REMOTE_REFRESH_URL },
        ...localeReplacements
    ];
}

function buildMountedSpeedPatch(ctx: ReturnType<typeof parseSwf>) {
    const abc = parseAbc(ctx);
    const classIndex = classIndexByName(abc, MOUNT_SPEED_PATCH_CLASS);
    if (classIndex === null) {
        throw new Error(`${MOUNT_SPEED_PATCH_CLASS} class not found in ${ctx.path}`);
    }

    const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, MOUNT_SPEED_PATCH_METHOD);
    if (methodIdx === null) {
        throw new Error(`${MOUNT_SPEED_PATCH_CLASS}.${MOUNT_SPEED_PATCH_METHOD} not found in ${ctx.path}`);
    }

    const methodBody = abc.methodBodies.get(methodIdx);
    if (!methodBody) {
        throw new Error(`${MOUNT_SPEED_PATCH_CLASS}.${MOUNT_SPEED_PATCH_METHOD} body not found in ${ctx.path}`);
    }

    const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
    const instructions = disassemble(code, `${MOUNT_SPEED_PATCH_CLASS}.${MOUNT_SPEED_PATCH_METHOD}`);
    const mountedGuardIndex = instructions.findIndex(
        (instruction) => u30OperandName(instruction, abc.multinameNames) === 'var_270'
    );
    if (mountedGuardIndex === -1) {
        throw new Error(`Mounted guard not found in ${MOUNT_SPEED_PATCH_CLASS}.${MOUNT_SPEED_PATCH_METHOD}`);
    }

    const dungeonFlagInstruction = instructions.find(
        (instruction, index) =>
            index > mountedGuardIndex &&
            instruction.opcode === 0x66 &&
            u30OperandName(instruction, abc.multinameNames) === MOUNT_SPEED_DUNGEON_FLAG
    );
    if (!dungeonFlagInstruction) {
        throw new Error(`${MOUNT_SPEED_DUNGEON_FLAG} access not found in ${MOUNT_SPEED_PATCH_CLASS}.${MOUNT_SPEED_PATCH_METHOD}`);
    }

    const patchedSequence = Buffer.from([0x29, 0x27, 0x02]);
    const currentSequence = code.subarray(
        dungeonFlagInstruction.offset,
        dungeonFlagInstruction.offset + patchedSequence.length
    );
    if (currentSequence.equals(patchedSequence)) {
        return [];
    }

    return [
        {
            key: `${MOUNT_SPEED_PATCH_CLASS}.${MOUNT_SPEED_PATCH_METHOD}.dungeonFlag`,
            start: methodBody.codeStart + dungeonFlagInstruction.offset,
            end: methodBody.codeStart + dungeonFlagInstruction.offset + patchedSequence.length,
            data: patchedSequence,
            detail: 'replace dungeon mount-speed flag read with false'
        }
    ];
}

function writeS24(value: number): Buffer {
    const out = Buffer.alloc(3);
    out[0] = value & 0xff;
    out[1] = (value >> 8) & 0xff;
    out[2] = (value >> 16) & 0xff;
    return out;
}

function buildServerAdjustHpCode(abc: ReturnType<typeof parseAbc>): Buffer {
    const names = abc.multinameNames;
    const maxHp = names.indexOf('maxHP');
    const currHp = names.indexOf('currHP');
    const id = names.indexOf('id');
    const game = names.indexOf('var_1');
    const clientEntId = names.indexOf('clientEntID');
    const updateLocalHp = names.indexOf('method_184');
    const takeDamage = names.indexOf('TakeDamage');
    for (const [label, value] of Object.entries({ maxHp, currHp, id, game, clientEntId, updateLocalHp, takeDamage })) {
        if (value <= 0) {
            throw new Error(`Missing multiname for ${HP_ADJUST_PATCH_CLASS}.${HP_ADJUST_PATCH_METHOD}: ${label}`);
        }
    }

    const chunks: Buffer[] = [];
    const labels = new Map<string, number>();
    const branches: Array<{ at: number; label: string }> = [];
    const pos = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const emit = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
    const emitU30 = (value: number) => chunks.push(writeU30(value));
    const emitGetProperty = (name: number) => {
        emit(0x66);
        emitU30(name);
    };
    const emitSetProperty = (name: number) => {
        emit(0x61);
        emitU30(name);
    };
    const emitCallPropVoid = (name: number, argCount: number) => {
        emit(0x4f);
        emitU30(name);
        emitU30(argCount);
    };
    const mark = (label: string) => labels.set(label, pos());
    const emitBranch = (opcode: number, label: string) => {
        emit(opcode);
        branches.push({ at: pos(), label });
        chunks.push(Buffer.from([0, 0, 0]));
    };

    emit(0xd0, 0x30); // getlocal0, pushscope
    emit(0x24, 0x00, 0x73, 0x63);
    emitU30(4); // var _loc4_:int = 0

    // Match the compiler's shared guard-branch shape so the duplicated boolean
    // is popped before either path reaches returnvoid.
    emit(0xd1, 0x96, 0x2a);
    emitBranch(0x11, 'guardDecision');
    emit(0x29, 0xd2, 0x24, 0x00, 0xab);
    mark('guardDecision');
    emitBranch(0x12, 'afterGuard');
    emit(0x47);
    mark('afterGuard');

    // Negative server adjustments are damage. The stock client ignored them,
    // which left remote player and party-frame HP stale.
    emit(0xd2, 0x24, 0x00);
    emitBranch(0x0c, 'afterNegativeDamage'); // if not less than 0
    emit(0xd1, 0xd2, 0x90, 0xd3);
    emitCallPropVoid(takeDamage, 2);
    emit(0x47);
    mark('afterNegativeDamage');

    // Existing positive-heal behavior, preserved.
    emit(0xd1);
    emitGetProperty(maxHp);
    emit(0xd1);
    emitGetProperty(currHp);
    emit(0xa1, 0x73, 0x63);
    emitU30(4);

    emit(0x62);
    emitU30(4);
    emit(0x24, 0x00);
    emitBranch(0x0d, 'afterFullHeal'); // if not <= 0
    emit(0xd1, 0xd1);
    emitGetProperty(maxHp);
    emitSetProperty(currHp);
    emit(0xd1);
    emitGetProperty(id);
    emit(0xd0);
    emitGetProperty(game);
    emitGetProperty(clientEntId);
    emitBranch(0x14, 'skipLocalHpUpdate');
    emit(0xd0);
    emitGetProperty(game);
    emit(0xd1);
    emitGetProperty(currHp);
    emitCallPropVoid(updateLocalHp, 1);
    mark('skipLocalHpUpdate');
    emit(0x47);
    mark('afterFullHeal');

    emit(0xd2, 0x62);
    emitU30(4);
    emitBranch(0x0e, 'afterClamp'); // if not > _loc4_
    emit(0x62);
    emitU30(4);
    emit(0x73, 0xd6);
    mark('afterClamp');
    emit(0xd1, 0xd2, 0x90, 0xd3);
    emitCallPropVoid(takeDamage, 2);
    emit(0x47);

    const code = Buffer.concat(chunks);
    for (const branch of branches) {
        const target = labels.get(branch.label);
        if (target === undefined) {
            throw new Error(`Missing branch label ${branch.label}`);
        }
        writeS24(target - (branch.at + 3)).copy(code, branch.at);
    }
    return code;
}

function buildServerAdjustHpDamagePatch(ctx: ReturnType<typeof parseSwf>) {
    const abc = parseAbc(ctx);
    const classIndex = classIndexByName(abc, HP_ADJUST_PATCH_CLASS);
    if (classIndex === null) {
        throw new Error(`${HP_ADJUST_PATCH_CLASS} class not found in ${ctx.path}`);
    }

    const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, HP_ADJUST_PATCH_METHOD);
    if (methodIdx === null) {
        throw new Error(`${HP_ADJUST_PATCH_CLASS}.${HP_ADJUST_PATCH_METHOD} not found in ${ctx.path}`);
    }

    const methodBody = abc.methodBodies.get(methodIdx);
    if (!methodBody) {
        throw new Error(`${HP_ADJUST_PATCH_CLASS}.${HP_ADJUST_PATCH_METHOD} body not found in ${ctx.path}`);
    }

    const patchedCode = buildServerAdjustHpCode(abc);
    const currentCode = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
    if (currentCode.equals(patchedCode)) {
        return [];
    }

    return [
        {
            key: `${HP_ADJUST_PATCH_CLASS}.${HP_ADJUST_PATCH_METHOD}.codeLen`,
            start: methodBody.codeLenPos,
            end: methodBody.codeStart,
            data: writeU30(patchedCode.length),
            detail: 'replace LinkUpdater HP adjust code length'
        },
        {
            key: `${HP_ADJUST_PATCH_CLASS}.${HP_ADJUST_PATCH_METHOD}.negativeDamage`,
            start: methodBody.codeStart,
            end: methodBody.codeStart + methodBody.codeLen,
            data: patchedCode,
            detail: 'allow negative server HP adjustments to damage remote players'
        }
    ];
}

function buildEntityIncrementalVisualRestoreCode(abc: ReturnType<typeof parseAbc>): Buffer {
    const names = abc.multinameNames;
    const var38 = names.indexOf('var_38');
    const var1667 = names.indexOf('var_1667');
    const var556 = names.indexOf('var_556');
    const gfx = names.indexOf('gfx');
    const theDisplayObject = names.indexOf('m_TheDO');
    const visible = names.indexOf('visible');
    for (const [label, value] of Object.entries({ var38, var1667, var556, gfx, theDisplayObject, visible })) {
        if (value <= 0) {
            throw new Error(`Missing multiname for ${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD}: ${label}`);
        }
    }

    const chunks: Buffer[] = [];
    const labels = new Map<string, number>();
    const branches: Array<{ at: number; label: string }> = [];
    const pos = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const emit = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
    const emitU30 = (value: number) => chunks.push(writeU30(value));
    const emitGetProperty = (name: number) => {
        emit(0x66);
        emitU30(name);
    };
    const emitSetProperty = (name: number) => {
        emit(0x61);
        emitU30(name);
    };
    const mark = (label: string) => labels.set(label, pos());
    const emitBranch = (opcode: number, label: string) => {
        emit(opcode);
        branches.push({ at: pos(), label });
        chunks.push(Buffer.from([0, 0, 0]));
    };

    emit(0xd3);
    emitGetProperty(var38);
    emitGetProperty(var1667);
    emitBranch(0x12, 'afterRestore');

    emit(0xd3);
    emitGetProperty(var38);
    emit(0x27);
    emitSetProperty(var1667);

    emit(0xd3);
    emitGetProperty(var38);
    emit(0x26);
    emitSetProperty(var556);

    emit(0xd3);
    emitGetProperty(gfx);
    emit(0x2a);
    emitBranch(0x12, 'noGfx');
    emitGetProperty(theDisplayObject);
    emit(0x2a);
    emitBranch(0x12, 'noDisplayObject');
    emit(0x26);
    emitSetProperty(visible);
    mark('afterRestore');
    emitBranch(0x10, 'done');
    mark('noDisplayObject');
    emit(0x29);
    emitBranch(0x10, 'done');
    mark('noGfx');
    emit(0x29);
    mark('done');

    const code = Buffer.concat(chunks);
    for (const branch of branches) {
        const target = labels.get(branch.label);
        if (target === undefined) {
            throw new Error(`Missing branch label ${branch.label}`);
        }
        writeS24(target - (branch.at + 3)).copy(code, branch.at);
    }
    return code;
}

function buildEntityIncrementalDeathTransitionCode(abc: ReturnType<typeof parseAbc>): Buffer {
    const names = abc.multinameNames;
    const var1 = names.indexOf('var_1');
    const gfx = names.indexOf('gfx');
    const sequence = names.indexOf('m_Seq');
    const resetSequence = names.indexOf('method_428');
    const mTimeThisTick = names.indexOf('mTimeThisTick');
    const var217 = names.indexOf('var_217');
    const var602 = names.indexOf('var_602');
    const var20 = names.indexOf('var_20');
    const entityClass = names.indexOf('Entity');
    const playerFlag = names.indexOf('PLAYER');
    const level = names.indexOf('level');
    const deathCounter = names.indexOf('var_1270');
    for (const [label, value] of Object.entries({
        var1,
        gfx,
        sequence,
        resetSequence,
        mTimeThisTick,
        var217,
        var602,
        var20,
        entityClass,
        playerFlag,
        level,
        deathCounter
    })) {
        if (value <= 0) {
            throw new Error(`Missing multiname for ${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD}: ${label}`);
        }
    }

    const chunks: Buffer[] = [];
    const labels = new Map<string, number>();
    const branches: Array<{ at: number; label: string }> = [];
    const pos = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const emit = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
    const emitU30 = (value: number) => chunks.push(writeU30(value));
    const emitGetProperty = (name: number) => {
        emit(0x66);
        emitU30(name);
    };
    const emitSetProperty = (name: number) => {
        emit(0x61);
        emitU30(name);
    };
    const emitCallPropVoid = (name: number, argCount: number) => {
        emit(0x4f);
        emitU30(name);
        emitU30(argCount);
    };
    const mark = (label: string) => labels.set(label, pos());
    const emitBranch = (opcode: number, label: string) => {
        emit(opcode);
        branches.push({ at: pos(), label });
        chunks.push(Buffer.from([0, 0, 0]));
    };

    emitBranch(0x12, 'afterDeathTransition');

    emit(0xd3);
    emitGetProperty(gfx);
    emit(0x2a);
    emitBranch(0x12, 'noGfx');
    emitGetProperty(sequence);
    emit(0x2a);
    emitBranch(0x12, 'noSequence');
    emitCallPropVoid(resetSequence, 0);
    emitBranch(0x10, 'afterSequence');
    mark('noSequence');
    emit(0x29);
    emitBranch(0x10, 'afterSequence');
    mark('noGfx');
    emit(0x29);
    mark('afterSequence');

    emit(0xd3, 0xd0);
    emitGetProperty(var1);
    emitGetProperty(mTimeThisTick);
    emitSetProperty(var217);

    emit(0xd3, 0x27);
    emitSetProperty(var602);

    emit(0xd3);
    emitGetProperty(var20);
    emit(0x60);
    emitU30(entityClass);
    emitGetProperty(playerFlag);
    emit(0xa8);
    emitBranch(0x12, 'afterPlayerCounter');

    emit(0xd0);
    emitGetProperty(var1);
    emit(0x2a);
    emitBranch(0x12, 'noGame');
    emitGetProperty(level);
    emit(0x2a);
    emitBranch(0x12, 'noLevel');
    emit(0x2a, 0x63);
    emitU30(10);
    emitGetProperty(deathCounter);
    emit(0x91, 0x63);
    emitU30(11);
    emit(0x62);
    emitU30(10);
    emit(0x62);
    emitU30(11);
    emitSetProperty(deathCounter);
    emit(0x08);
    emitU30(11);
    emit(0x08);
    emitU30(10);
    emitBranch(0x10, 'afterPlayerCounter');
    mark('noLevel');
    emit(0x29);
    emitBranch(0x10, 'afterPlayerCounter');
    mark('noGame');
    emit(0x29);
    mark('afterPlayerCounter');

    mark('afterDeathTransition');

    const code = Buffer.concat(chunks);
    for (const branch of branches) {
        const target = labels.get(branch.label);
        if (target === undefined) {
            throw new Error(`Missing branch label ${branch.label}`);
        }
        writeS24(target - (branch.at + 3)).copy(code, branch.at);
    }
    return code;
}

function buildEntityIncrementalVisualRestorePatch(ctx: ReturnType<typeof parseSwf>) {
    const abc = parseAbc(ctx);
    const classIndex = classIndexByName(abc, ENTITY_INCREMENTAL_PATCH_CLASS);
    if (classIndex === null) {
        throw new Error(`${ENTITY_INCREMENTAL_PATCH_CLASS} class not found in ${ctx.path}`);
    }

    const methodIdx = methodIdxForTrait(abc.instances[classIndex].traits, abc, ENTITY_INCREMENTAL_PATCH_METHOD);
    if (methodIdx === null) {
        throw new Error(`${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD} not found in ${ctx.path}`);
    }

    const methodBody = abc.methodBodies.get(methodIdx);
    if (!methodBody) {
        throw new Error(`${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD} body not found in ${ctx.path}`);
    }

    const names = abc.multinameNames;
    const instructions = disassemble(
        ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen),
        `${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD}`
    );
    const deathBlockStartIndex = instructions.findIndex((instruction, index) =>
        instruction.opcode === 0x12 &&
        instructions[index + 1]?.opcode === 0xd3 &&
        instructions[index + 2]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 2], names) === 'gfx' &&
        instructions[index + 3]?.opcode === 0x76
    );
    if (deathBlockStartIndex === -1) {
        throw new Error(`${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD} death transition block not found`);
    }

    const deathBlockEndIndex = instructions.findIndex((instruction, index) =>
        index > deathBlockStartIndex &&
        instruction.opcode === 0xd3 &&
        instructions[index + 1]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 1], names) === 'var_602'
    );
    if (deathBlockEndIndex === -1) {
        throw new Error(`${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD} death transition block end not found`);
    }

    const blockStartIndex = instructions.findIndex((instruction, index) =>
        instruction.opcode === 0xd3 &&
        instructions[index + 1]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 1], names) === 'var_38' &&
        instructions[index + 2]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 2], names) === 'var_1667' &&
        instructions[index + 3]?.opcode === 0x12
    );
    if (blockStartIndex === -1) {
        throw new Error(`${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD} spawn-hidden restore block not found`);
    }

    const visibleSetIndex = instructions.findIndex((instruction, index) =>
        index > blockStartIndex &&
        instruction.opcode === 0x61 &&
        u30OperandName(instruction, names) === 'visible'
    );
    if (visibleSetIndex === -1) {
        throw new Error(`${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD} visible restore write not found`);
    }

    const blockStartOffset = instructions[blockStartIndex].offset;
    const blockEndOffset = instructions[visibleSetIndex].offset + instructions[visibleSetIndex].size;
    const deathBlockStartOffset = instructions[deathBlockStartIndex].offset;
    const deathBlockEndOffset = instructions[deathBlockEndIndex].offset;
    const patchedBlock = buildEntityIncrementalVisualRestoreCode(abc);
    const patchedDeathBlock = buildEntityIncrementalDeathTransitionCode(abc);
    const currentBlock = ctx.body.subarray(
        methodBody.codeStart + blockStartOffset,
        methodBody.codeStart + blockEndOffset
    );
    const currentDeathBlock = ctx.body.subarray(
        methodBody.codeStart + deathBlockStartOffset,
        methodBody.codeStart + deathBlockEndOffset
    );
    const bodyPatches = [];
    let patchedCodeLen = methodBody.codeLen;
    if (!currentDeathBlock.equals(patchedDeathBlock)) {
        patchedCodeLen += patchedDeathBlock.length - currentDeathBlock.length;
        bodyPatches.push({
            key: `${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD}.deathTransitionGuard`,
            start: methodBody.codeStart + deathBlockStartOffset,
            end: methodBody.codeStart + deathBlockEndOffset,
            data: patchedDeathBlock,
            detail: 'guard LinkUpdater incremental player death transition against missing level/gfx'
        });
    }
    if (!currentBlock.equals(patchedBlock)) {
        patchedCodeLen += patchedBlock.length - currentBlock.length;
        bodyPatches.push({
            key: `${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD}.visualRestoreGuard`,
            start: methodBody.codeStart + blockStartOffset,
            end: methodBody.codeStart + blockEndOffset,
            data: patchedBlock,
            detail: 'guard LinkUpdater incremental state visual restore against destroyed gfx'
        });
    }
    if (bodyPatches.length === 0) {
        return [];
    }

    return [
        {
            key: `${ENTITY_INCREMENTAL_PATCH_CLASS}.${ENTITY_INCREMENTAL_PATCH_METHOD}.codeLen`,
            start: methodBody.codeLenPos,
            end: methodBody.codeStart,
            data: writeU30(patchedCodeLen),
            detail: 'replace LinkUpdater incremental state code length'
        },
        ...bodyPatches
    ];
}

export function buildDungeonBlitzSwfVariantBuffer(
    swfPath: string,
    mode: DungeonBlitzSwfMode,
    locale: DungeonBlitzSwfLocale = 'en'
): Buffer {
    const ctx = parseSwf(swfPath);
    const abc = parseAbc(ctx);
    const patches = [];

    for (const replacement of getReplacements(mode, locale)) {
        for (let index = 1; index < abc.stringValues.length; index++) {
            if (abc.stringValues[index] !== replacement.oldValue) {
                continue;
            }

            const replacementBytes = Buffer.from(replacement.newValue, 'utf8');
            const originalBytes = Buffer.from(replacement.oldValue, 'utf8');
            patches.push({
                key: `string:${replacement.oldValue}:${index}`,
                start: abc.stringLenPositions[index],
                end: abc.stringDataPositions[index] + originalBytes.length,
                data: Buffer.concat([writeU30(replacementBytes.length), replacementBytes]),
                detail: `${replacement.oldValue} -> ${replacement.newValue}`
            });
        }
    }

    patches.push(...buildMountedSpeedPatch(ctx));
    patches.push(...buildServerAdjustHpDamagePatch(ctx));
    patches.push(...buildEntityIncrementalVisualRestorePatch(ctx));

    const { body, delta } = applyPatchesToBody(ctx.body, patches);
    const outBody = Buffer.from(body);
    if (delta !== 0) {
        outBody.writeUInt32LE(ctx.doabcLen + delta, ctx.doabcLenFieldPos);
    }

    const header = Buffer.alloc(8);
    header.write(ctx.signature, 0, 'ascii');
    header[3] = ctx.version;
    header.writeUInt32LE(8 + outBody.length, 4);

    return ctx.signature === 'CWS'
        ? Buffer.concat([header, zlib.deflateSync(outBody)])
        : Buffer.concat([header, outBody]);
}
