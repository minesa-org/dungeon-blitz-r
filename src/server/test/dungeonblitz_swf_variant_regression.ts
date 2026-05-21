import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildDungeonBlitzSwfVariantBuffer } from '../core/DungeonBlitzSwf';
import { Config } from '../core/config';
import {
    classIndexByName,
    disassemble,
    methodIdxForTrait,
    parseAbc,
    parseSwf,
    u30OperandName
} from '../scripts/swfPatchUtils';
import type { Instruction } from '../scripts/swfPatchUtils';

function resolveBaseSwfPath(): string {
    const candidates = [
        path.resolve(__dirname, '../../client/content/localhost/p/cbp/DungeonBlitz.swf'),
        path.resolve(__dirname, '../../../client/content/localhost/p/cbp/DungeonBlitz.swf'),
        path.resolve(process.cwd(), 'src/client/content/localhost/p/cbp/DungeonBlitz.swf'),
        path.resolve(process.cwd(), '../client/content/localhost/p/cbp/DungeonBlitz.swf')
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

const BASE_SWF_PATH = resolveBaseSwfPath();
const MULTIPLAYER_HOST = Config.MULTIPLAYER_HOST;
const LOCAL_REFRESH_URL = 'http://localhost:8000/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp';
const MULTIPLAYER_REFRESH_URL = `http://${MULTIPLAYER_HOST}/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp`;
const LEGACY_REFRESH_URL = '/p/cbp/DungeonBlitz.swf?fv=cbq&gv=cbp';
const BITMAPDATA_TOTAL_PIXELS = 16777215;
const CLASS82_SCENE_CACHE_SAFE_PIXELS = 4194304;
const SUPERANIM_METHOD200_SAFE_PIXELS = 65536;
const SUPERANIM_METHOD982_SAFE_PIXELS = 4194304;
const SUPERANIM_METHOD982_SAFE_AXIS = 8191;
const SUPERANIM_METHOD806_FULLSCREEN_ENTITY_BITMAP_SIZE = 1024;
const SAFE_SCREEN_BITMAP_WIDTH = 2048;
const SAFE_SCREEN_BITMAP_HEIGHT = 1152;
const MAX_CLASS33_CACHE_BITMAP_WIDTH = 2048;
const MAX_CLASS33_CACHE_BITMAP_HEIGHT = 1152;

function getStringMatches(swfPath: string, target: string): number[] {
    const ctx = parseSwf(swfPath);
    const abc = parseAbc(ctx);
    const matches: number[] = [];

    for (let index = 1; index < abc.stringValues.length; index++) {
        if (abc.stringValues[index] === target) {
            matches.push(index);
        }
    }

    return matches;
}

function getStringMatchCount(swfPath: string, target: string): number {
    return getStringMatches(swfPath, target).length;
}

function getMountedSpeedBranchOpcode(swfPath: string): number {
    const ctx = parseSwf(swfPath);
    const abc = parseAbc(ctx);
    const classIndex = classIndexByName(abc, 'CombatState');
    assert.notEqual(classIndex, null, 'CombatState class not found');

    const methodIdx = methodIdxForTrait(abc.instances[classIndex!].traits, abc, 'method_960');
    assert.notEqual(methodIdx, null, 'CombatState.method_960 not found');

    const methodBody = abc.methodBodies.get(methodIdx!);
    assert.ok(methodBody, 'CombatState.method_960 body not found');

    const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
    const instructions = disassemble(code, 'CombatState.method_960');
    const mountedGuardIndex = instructions.findIndex(
        (instruction, index) =>
            u30OperandName(instruction, abc.multinameNames) === 'var_270'
    );
    assert.notEqual(mountedGuardIndex, -1, 'Mounted guard not found');

    const dungeonFlag = instructions.find(
        (instruction, index) =>
            index > mountedGuardIndex! &&
            instruction.opcode === 0x66 &&
            u30OperandName(instruction, abc.multinameNames) === 'bInstanced'
    );
    return dungeonFlag ? dungeonFlag.opcode : -1;
}

function getLocalOperand(instruction: Instruction | undefined): number | null {
    if (!instruction) {
        return null;
    }
    if (instruction.opcode >= 0xd0 && instruction.opcode <= 0xd3) {
        return instruction.opcode - 0xd0;
    }
    if (instruction.opcode === 0x62 && instruction.operands[0]?.[0] === 'u30') {
        return instruction.operands[0][1];
    }
    return null;
}

function getStaticMethodCode(swfPath: string, className: string, methodName: string) {
    const ctx = parseSwf(swfPath);
    const abc = parseAbc(ctx);
    const classIndex = classIndexByName(abc, className);
    assert.notEqual(classIndex, null, `${className} class not found`);

    const methodIdx = methodIdxForTrait(abc.classTraits[classIndex!], abc, methodName);
    assert.notEqual(methodIdx, null, `${className}.${methodName} not found`);

    const methodBody = abc.methodBodies.get(methodIdx!);
    assert.ok(methodBody, `${className}.${methodName} body not found`);

    const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
    return {
        abc,
        methodBody,
        instructions: disassemble(code, `${className}.${methodName}`)
    };
}

function assertGameMethod1325SuperAnimCrashGuard(swfPath: string): void {
    const { abc, methodBody, instructions } = getInstanceMethodCode(swfPath, 'Game', 'method_1325');
    const callIndex = instructions.findIndex((instruction) =>
        instruction.opcode === 0x46 &&
        u30OperandName(instruction, abc.multinameNames) === 'method_105' &&
        instruction.operands[1]?.[1] === 0
    );
    assert.notEqual(callIndex, -1, 'Game.method_1325 SuperAnimInstance.method_105 call not found');

    const call = instructions[callIndex];
    const receiver = instructions[callIndex - 1];
    assert.equal(getLocalOperand(receiver), 2, 'Game.method_1325 must call method_105 on the current SuperAnimInstance');

    const errorName = abc.multinameNames.findIndex((name) => name === 'Error');
    const finishedName = abc.multinameNames.findIndex((name) => name === 'm_bFinished');
    assert.notEqual(errorName, -1, 'Error multiname not found');
    assert.notEqual(finishedName, -1, 'm_bFinished multiname not found');

    const guard = methodBody.exceptions.find((entry) =>
        entry.from <= receiver.offset &&
        entry.to >= call.offset + call.size &&
        entry.type === errorName &&
        entry.target > call.offset
    );
    assert.ok(guard, 'Game.method_1325 must catch SuperAnimInstance.method_105 render errors');

    const handlerWindow = instructions.filter((instruction) =>
        instruction.offset >= guard.target &&
        instruction.offset < guard.target + 40
    );
    assert.equal(
        handlerWindow.some((instruction) =>
            instruction.opcode === 0x61 &&
            instruction.operands[0]?.[1] === finishedName
        ),
        true,
        'Game.method_1325 SuperAnim crash handler must mark the instance finished'
    );
}

function assertGameMethod1970EntityUpdateCrashGuard(swfPath: string): void {
    const { abc, methodBody, instructions } = getInstanceMethodCode(swfPath, 'Game', 'method_1970');
    const callIndex = instructions.findIndex((instruction) =>
        instruction.opcode === 0x46 &&
        u30OperandName(instruction, abc.multinameNames) === 'method_1770' &&
        instruction.operands[1]?.[1] === 0
    );
    assert.notEqual(callIndex, -1, 'Game.method_1970 Entity.method_1770 call not found');

    const call = instructions[callIndex];
    const receiver = instructions[callIndex - 1];
    assert.equal(getLocalOperand(receiver), 2, 'Game.method_1970 must call method_1770 on the current Entity');

    const errorName = abc.multinameNames.findIndex((name) => name === 'Error');
    assert.notEqual(errorName, -1, 'Error multiname not found');

    const guard = methodBody.exceptions.find((entry) =>
        entry.from <= receiver.offset &&
        entry.to >= call.offset + call.size &&
        entry.type === errorName &&
        entry.target > call.offset
    );
    assert.ok(guard, 'Game.method_1970 must catch Entity.method_1770 update errors');

    const handlerWindow = instructions.filter((instruction) =>
        instruction.offset >= guard.target &&
        instruction.offset < guard.target + 60
    );
    const clientEntName = abc.multinameNames.findIndex((name) => name === 'clientEnt');
    const destroyEntityName = abc.multinameNames.findIndex((name) => name === 'DestroyEntity');
    const spliceName = abc.multinameNames.findIndex((name) => name === 'splice');
    assert.notEqual(clientEntName, -1, 'clientEnt multiname not found');
    assert.notEqual(destroyEntityName, -1, 'DestroyEntity multiname not found');
    assert.notEqual(spliceName, -1, 'splice multiname not found');
    assert.equal(
        handlerWindow.some((instruction) =>
            instruction.opcode === 0x66 &&
            instruction.operands[0]?.[1] === clientEntName
        ),
        true,
        'Game.method_1970 entity update crash handler must not destroy the client entity'
    );
    assert.equal(
        handlerWindow.some((instruction) =>
            instruction.opcode === 0x4f &&
            instruction.operands[0]?.[1] === destroyEntityName
        ),
        true,
        'Game.method_1970 entity update crash handler must destroy the failed entity'
    );
    assert.equal(
        handlerWindow.some((instruction) =>
            instruction.opcode === 0x4f &&
            instruction.operands[0]?.[1] === spliceName
        ),
        true,
        'Game.method_1970 entity update crash handler must remove the failed entity from the entity list'
    );
}

function assertGameMethod1070ChatBubbleCrashGuard(swfPath: string): void {
    const { abc, methodBody, instructions } = getInstanceMethodCode(swfPath, 'Game', 'method_1070');
    const callIndex = instructions.findIndex((instruction) =>
        instruction.opcode === 0x4f &&
        u30OperandName(instruction, abc.multinameNames) === 'method_901' &&
        instruction.operands[1]?.[1] === 0
    );
    assert.notEqual(callIndex, -1, 'Game.method_1070 ChatBubble.method_901 call not found');

    const call = instructions[callIndex];
    const receiver = instructions[callIndex - 1];
    assert.equal(getLocalOperand(receiver), 1, 'Game.method_1070 must call method_901 on the current ChatBubble');

    const errorName = abc.multinameNames.findIndex((name) => name === 'Error');
    const validName = abc.multinameNames.findIndex((name) => name === 'bIAmValid');
    assert.notEqual(errorName, -1, 'Error multiname not found');
    assert.notEqual(validName, -1, 'bIAmValid multiname not found');

    const guard = methodBody.exceptions.find((entry) =>
        entry.from <= receiver.offset &&
        entry.to >= call.offset + call.size &&
        entry.type === errorName &&
        entry.target > call.offset
    );
    assert.ok(guard, 'Game.method_1070 must catch ChatBubble.method_901 update errors');

    const handlerWindow = instructions.filter((instruction) =>
        instruction.offset >= guard.target &&
        instruction.offset < guard.target + 40
    );
    assert.equal(
        handlerWindow.some((instruction) =>
            instruction.opcode === 0x61 &&
            instruction.operands[0]?.[1] === validName
        ),
        true,
        'Game.method_1070 ChatBubble crash handler must invalidate the failed bubble'
    );
}

function assertGameMethod1946RenderCrashGuard(swfPath: string): void {
    const { abc, methodBody, instructions } = getInstanceMethodCode(swfPath, 'Game', 'method_1946');
    const errorName = abc.multinameNames.findIndex((name) => name === 'Error');
    assert.notEqual(errorName, -1, 'Error multiname not found');

    const pushScopeIndex = instructions.findIndex((instruction) => instruction.opcode === 0x30);
    assert.notEqual(pushScopeIndex, -1, 'Game.method_1946 pushscope not found');

    const firstBodyInstruction = instructions[pushScopeIndex + 1];
    assert.ok(firstBodyInstruction, 'Game.method_1946 body is empty');

    assert.equal(
        methodBody.exceptions.some((entry) =>
            entry.from === firstBodyInstruction.offset &&
            entry.type === errorName &&
            entry.target > entry.to
        ),
        true,
        'Game.method_1946 render body must be caught so stale snapshot state cannot crash'
    );

    assert.equal(
        instructions.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            instructions[index + 1]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 1], abc.multinameNames) === 'main' &&
            instructions[index + 2]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 2], abc.multinameNames) === 'var_147' &&
            instructions[index + 3]?.opcode === 0x2a &&
            instructions[index + 4]?.opcode === 0x11 &&
            instructions[index + 5]?.opcode === 0x29 &&
            instructions[index + 6]?.opcode === 0x47 &&
            instructions[index + 7]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 7], abc.multinameNames) === 'bitmapData' &&
            instructions[index + 8]?.opcode === 0x11 &&
            instructions[index + 9]?.opcode === 0x47
        ),
        true,
        'Game.method_1946 must skip capture before hiding layers when the transition bitmap is missing'
    );
}

function assertEntityMethod900GfxGuard(swfPath: string): void {
    const { abc, instructions } = getInstanceMethodCode(swfPath, 'Entity', 'method_900');

    assert.equal(
        instructions.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            instructions[index + 1]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 1], abc.multinameNames) === 'gfx' &&
            instructions[index + 2]?.opcode === 0x2a &&
            instructions[index + 3]?.opcode === 0x11 &&
            instructions[index + 4]?.opcode === 0x29 &&
            instructions[index + 5]?.opcode === 0x47 &&
            instructions[index + 6]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 6], abc.multinameNames) === 'm_TheDO' &&
            instructions[index + 7]?.opcode === 0x11 &&
            instructions[index + 8]?.opcode === 0x47
        ),
        true,
        'Entity.method_900 must skip position updates when gfx or gfx.m_TheDO is already cleared'
    );
}

function assertEntityMethod853GfxGuard(swfPath: string): void {
    const { abc, instructions } = getInstanceMethodCode(swfPath, 'Entity', 'method_853');

    assert.equal(
        instructions.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            instructions[index + 1]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 1], abc.multinameNames) === 'gfx' &&
            instructions[index + 2]?.opcode === 0x2a &&
            instructions[index + 3]?.opcode === 0x11 &&
            instructions[index + 4]?.opcode === 0x29 &&
            instructions[index + 5]?.opcode === 0x47 &&
            instructions[index + 6]?.opcode === 0x2a &&
            instructions[index + 7]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 7], abc.multinameNames) === 'm_TheDO' &&
            instructions[index + 8]?.opcode === 0x11 &&
            instructions[index + 9]?.opcode === 0x29 &&
            instructions[index + 10]?.opcode === 0x47 &&
            instructions[index + 11]?.opcode === 0x2a &&
            instructions[index + 12]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 12], abc.multinameNames) === 'm_Data' &&
            instructions[index + 13]?.opcode === 0x2a &&
            instructions[index + 14]?.opcode === 0x11 &&
            instructions[index + 15]?.opcode === 0x29 &&
            instructions[index + 16]?.opcode === 0x29 &&
            instructions[index + 17]?.opcode === 0x47 &&
            instructions[index + 18]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 18], abc.multinameNames) === 'var_36' &&
            instructions[index + 19]?.opcode === 0x11 &&
            instructions[index + 20]?.opcode === 0x29 &&
            instructions[index + 21]?.opcode === 0x47
        ),
        true,
        'Entity.method_853 must skip animation-facing updates when gfx internals are already cleared'
    );
}

function assertEntityMethod511LayerReferenceGuard(swfPath: string): void {
    const { abc, instructions } = getInstanceMethodCode(swfPath, 'Entity', 'method_511');
    const guardIndex = instructions.findIndex((instruction, index) =>
            instruction.opcode === 0xd0 &&
            instructions[index + 1]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 1], abc.multinameNames) === 'gfx' &&
            instructions[index + 2]?.opcode === 0x2a &&
            instructions[index + 3]?.opcode === 0x11 &&
            instructions[index + 4]?.opcode === 0x29 &&
            instructions[index + 5]?.opcode === 0x47 &&
            instructions[index + 6]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 6], abc.multinameNames) === 'm_TheDO' &&
            instructions[index + 7]?.opcode === 0x11 &&
            instructions[index + 8]?.opcode === 0x47 &&
            instructions[index + 9]?.opcode === 0xd2 &&
            instructions[index + 10]?.opcode === 0x2a &&
            instructions[index + 11]?.opcode === 0x11 &&
            instructions[index + 12]?.opcode === 0x29 &&
            instructions[index + 13]?.opcode === 0x47 &&
            instructions[index + 14]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 14], abc.multinameNames) === 'gfx' &&
            instructions[index + 15]?.opcode === 0x2a &&
            instructions[index + 16]?.opcode === 0x11 &&
            instructions[index + 17]?.opcode === 0x29 &&
            instructions[index + 18]?.opcode === 0x47 &&
            instructions[index + 19]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 19], abc.multinameNames) === 'm_TheDO' &&
            instructions[index + 20]?.opcode === 0x2a &&
            instructions[index + 21]?.opcode === 0x11 &&
            instructions[index + 22]?.opcode === 0x29 &&
            instructions[index + 23]?.opcode === 0x47 &&
            instructions[index + 24]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 24], abc.multinameNames) === 'parent' &&
            instructions[index + 25]?.opcode === 0xd0 &&
            instructions[index + 26]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 26], abc.multinameNames) === 'var_1' &&
            instructions[index + 27]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 27], abc.multinameNames) === 'playerEntLayer' &&
            instructions[index + 28]?.opcode === 0xab &&
            instructions[index + 29]?.opcode === 0x11 &&
            instructions[index + 30]?.opcode === 0x47
    );

    assert.notEqual(
        guardIndex,
        -1,
        'Entity.method_511 must skip spawn/reset layer sorting when the reference DisplayObject is stale or detached'
    );

    const expressionIndex = instructions.findIndex((instruction, index) =>
        index > guardIndex &&
        instruction.opcode === 0xd0 &&
        instructions[index + 1]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 1], abc.multinameNames) === 'var_1' &&
        instructions[index + 2]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 2], abc.multinameNames) === 'playerEntLayer' &&
        instructions[index + 3]?.opcode === 0xd0 &&
        instructions[index + 4]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 4], abc.multinameNames) === 'gfx' &&
        instructions[index + 5]?.opcode === 0x66 &&
        u30OperandName(instructions[index + 5], abc.multinameNames) === 'm_TheDO'
    );
    assert.notEqual(expressionIndex, -1, 'Entity.method_511 guarded layer expression not found');

    const guardOffset = instructions[guardIndex].offset;
    const expressionOffset = instructions[expressionIndex].offset;
    assert.equal(
        instructions.some((instruction) =>
            instruction.offset < guardOffset &&
            instruction.opcode >= 0x0c &&
            instruction.opcode <= 0x1a &&
            instruction.operands[0]?.[0] === 's24' &&
            instruction.offset + instruction.size + instruction.operands[0][1] === expressionOffset
        ),
        false,
        'Entity.method_511 branches entering the layer expression must pass through the guard first'
    );
}

function getInstanceMethodCode(swfPath: string, className: string, methodName: string) {
    const ctx = parseSwf(swfPath);
    const abc = parseAbc(ctx);
    const classIndex = classIndexByName(abc, className);
    assert.notEqual(classIndex, null, `${className} class not found`);

    const methodIdx = methodIdxForTrait(abc.instances[classIndex!].traits, abc, methodName);
    assert.notEqual(methodIdx, null, `${className}.${methodName} not found`);

    const methodBody = abc.methodBodies.get(methodIdx!);
    assert.ok(methodBody, `${className}.${methodName} body not found`);

    const code = ctx.body.subarray(methodBody.codeStart, methodBody.codeStart + methodBody.codeLen);
    return {
        abc,
        methodBody,
        instructions: disassemble(code, `${className}.${methodName}`)
    };
}

function findBitmapDataConstructorIndex(
    instructions: Instruction[],
    names: string[],
    widthLocal: number,
    heightLocal: number
): number {
    return instructions.findIndex((instruction, index) => {
        const width = instructions[index + 1];
        const height = instructions[index + 2];
        const pushTrue = instructions[index + 3];
        const pushZero = instructions[index + 4];
        const construct = instructions[index + 5];

        return (
            instruction.opcode === 0x5d &&
            u30OperandName(instruction, names) === 'BitmapData' &&
            getLocalOperand(width) === widthLocal &&
            getLocalOperand(height) === heightLocal &&
            pushTrue?.opcode === 0x26 &&
            pushZero?.opcode === 0x24 &&
            pushZero.operands[0]?.[1] === 0 &&
            construct?.opcode === 0x4a &&
            u30OperandName(construct, names) === 'BitmapData' &&
            construct.operands[1]?.[1] === 4
        );
    });
}

function findPropertyBitmapDataConstructorIndex(
    instructions: Instruction[],
    names: string[],
    widthName: string,
    heightName: string
): number {
    return instructions.findIndex((instruction, index) => {
        const widthSelf = instructions[index + 1];
        const width = instructions[index + 2];
        const heightSelf = instructions[index + 3];
        const height = instructions[index + 4];
        const pushTrue = instructions[index + 5];
        const construct = instructions[index + 6];

        return (
            instruction.opcode === 0x5d &&
            u30OperandName(instruction, names) === 'BitmapData' &&
            widthSelf?.opcode === 0xd0 &&
            width?.opcode === 0x66 &&
            u30OperandName(width, names) === widthName &&
            heightSelf?.opcode === 0xd0 &&
            height?.opcode === 0x66 &&
            u30OperandName(height, names) === heightName &&
            pushTrue?.opcode === 0x26 &&
            construct?.opcode === 0x4a &&
            u30OperandName(construct, names) === 'BitmapData' &&
            construct.operands[1]?.[1] === 3
        );
    });
}

function assertBitmapDataGuardWindow(
    swfPath: string,
    widthLocal: number,
    heightLocal: number,
    label: string
): void {
    const { abc, instructions } = getStaticMethodCode(swfPath, 'SuperAnimData', 'method_200');
    const constructorIndex = findBitmapDataConstructorIndex(
        instructions,
        abc.multinameNames,
        widthLocal,
        heightLocal
    );
    assert.notEqual(constructorIndex, -1, `${label} BitmapData constructor not found`);

    const guardWindow = instructions.slice(Math.max(0, constructorIndex - 75), constructorIndex);
    assert.equal(
        guardWindow.filter((instruction) => instruction.opcode === 0x25 && instruction.operands[0]?.[1] === 8191).length >= 2,
        true,
        `${label} must enforce Flash's 8191 BitmapData axis limit`
    );
    assert.equal(
        guardWindow.some((instruction, index) => {
            const pushIntOperand = guardWindow[index + 3]?.operands[0];
            return (
                getLocalOperand(instruction) === widthLocal &&
                getLocalOperand(guardWindow[index + 1]) === heightLocal &&
                guardWindow[index + 2]?.opcode === 0xa2 &&
                guardWindow[index + 3]?.opcode === 0x2d &&
                pushIntOperand?.[0] === 'u30' &&
                abc.intValues[pushIntOperand[1]] === SUPERANIM_METHOD200_SAFE_PIXELS &&
                guardWindow[index + 4]?.opcode === 0xaf
            );
        }),
        true,
        `${label} must enforce the BitmapData total pixel limit`
    );
    assert.equal(
        guardWindow.filter((instruction) => instruction.opcode === 0x25 && instruction.operands[0]?.[1] === 128).length >= 2,
        true,
        `${label} fallback must use a visible 128x128 BitmapData instead of 1x1`
    );
}

function assertClass82BitmapDataGuardWindow(swfPath: string): void {
    const { abc, instructions } = getInstanceMethodCode(swfPath, 'class_82', 'method_193');
    const widthLocal = 8;
    const heightLocal = 9;
    const constructorIndex = findBitmapDataConstructorIndex(
        instructions,
        abc.multinameNames,
        widthLocal,
        heightLocal
    );
    assert.notEqual(constructorIndex, -1, 'class_82.method_193 BitmapData constructor not found');

    const guardWindow = instructions.slice(Math.max(0, constructorIndex - 75), constructorIndex);
    assert.equal(
        guardWindow.filter((instruction) => instruction.opcode === 0x25 && instruction.operands[0]?.[1] === 8191).length >= 2,
        true,
        'class_82.method_193 must enforce Flash\'s 8191 BitmapData axis limit'
    );
    assert.equal(
        guardWindow.some((instruction, index) => {
            const pushIntOperand = guardWindow[index + 3]?.operands[0];
            return (
                getLocalOperand(instruction) === widthLocal &&
                getLocalOperand(guardWindow[index + 1]) === heightLocal &&
                guardWindow[index + 2]?.opcode === 0xa2 &&
                guardWindow[index + 3]?.opcode === 0x2d &&
                pushIntOperand?.[0] === 'u30' &&
                abc.intValues[pushIntOperand[1]] === CLASS82_SCENE_CACHE_SAFE_PIXELS &&
                guardWindow[index + 4]?.opcode === 0xaf
            );
        }),
        true,
        'class_82.method_193 must enforce the scene-cache BitmapData safe pixel limit'
    );
    assert.equal(
        instructions.some((instruction, index) =>
            instruction.opcode === 0x66 &&
            u30OperandName(instruction, abc.multinameNames) === 'var_2825' &&
            instructions[index + 1]?.opcode === 0x24 &&
            instructions[index + 1]?.operands[0]?.[1] === 2 &&
            instructions[index + 2]?.opcode === 0xa3 &&
            instructions[index + 3]?.opcode === 0x75
        ),
        true,
        'class_82.method_193 must halve cache render scale before BitmapData allocation'
    );
}

function assertClass23BitmapDataGuardWindow(swfPath: string): void {
    const { abc, instructions } = getInstanceMethodCode(swfPath, 'class_23', 'method_942');
    const widthName = 'var_1707';
    const heightName = 'var_2152';
    const constructorIndex = findPropertyBitmapDataConstructorIndex(
        instructions,
        abc.multinameNames,
        widthName,
        heightName
    );
    assert.notEqual(constructorIndex, -1, 'class_23.method_942 BitmapData constructor not found');

    const guardWindow = instructions.slice(Math.max(0, constructorIndex - 75), constructorIndex);
    assert.equal(
        guardWindow.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            guardWindow[index + 1]?.opcode === 0x66 &&
            u30OperandName(guardWindow[index + 1], abc.multinameNames) === widthName &&
            guardWindow[index + 2]?.opcode === 0xd0 &&
            guardWindow[index + 3]?.opcode === 0x66 &&
            u30OperandName(guardWindow[index + 3], abc.multinameNames) === widthName &&
            guardWindow[index + 4]?.opcode === 0xab &&
            guardWindow[index + 5]?.opcode === 0x12
        ),
        true,
        'class_23.method_942 must reject NaN cache widths'
    );
    assert.equal(
        guardWindow.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            guardWindow[index + 1]?.opcode === 0x66 &&
            u30OperandName(guardWindow[index + 1], abc.multinameNames) === heightName &&
            guardWindow[index + 2]?.opcode === 0xd0 &&
            guardWindow[index + 3]?.opcode === 0x66 &&
            u30OperandName(guardWindow[index + 3], abc.multinameNames) === heightName &&
            guardWindow[index + 4]?.opcode === 0xab &&
            guardWindow[index + 5]?.opcode === 0x12
        ),
        true,
        'class_23.method_942 must reject NaN cache heights'
    );
    assert.equal(
        guardWindow.filter((instruction) => instruction.opcode === 0x25 && instruction.operands[0]?.[1] === 8191).length >= 2,
        true,
        'class_23.method_942 must enforce Flash\'s 8191 BitmapData axis limit'
    );
    assert.equal(
        guardWindow.some((instruction, index) => {
            const pushIntOperand = guardWindow[index + 5]?.operands[0];
            return (
                instruction.opcode === 0xd0 &&
                guardWindow[index + 1]?.opcode === 0x66 &&
                u30OperandName(guardWindow[index + 1], abc.multinameNames) === widthName &&
                guardWindow[index + 2]?.opcode === 0xd0 &&
                guardWindow[index + 3]?.opcode === 0x66 &&
                u30OperandName(guardWindow[index + 3], abc.multinameNames) === heightName &&
                guardWindow[index + 4]?.opcode === 0xa2 &&
                guardWindow[index + 5]?.opcode === 0x2d &&
                pushIntOperand?.[0] === 'u30' &&
                abc.intValues[pushIntOperand[1]] === BITMAPDATA_TOTAL_PIXELS &&
                guardWindow[index + 6]?.opcode === 0xaf
            );
        }),
        true,
        'class_23.method_942 must enforce the BitmapData total pixel limit'
    );
    assert.equal(
        guardWindow.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            guardWindow[index + 1]?.opcode === 0x25 &&
            guardWindow[index + 1]?.operands[0]?.[1] === 512 &&
            guardWindow[index + 2]?.opcode === 0x68 &&
            u30OperandName(guardWindow[index + 2], abc.multinameNames) === widthName
        ),
        true,
        'class_23.method_942 fallback must reset cache width to 512'
    );
    assert.equal(
        guardWindow.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            guardWindow[index + 1]?.opcode === 0x25 &&
            guardWindow[index + 1]?.operands[0]?.[1] === 512 &&
            guardWindow[index + 2]?.opcode === 0x68 &&
            u30OperandName(guardWindow[index + 2], abc.multinameNames) === heightName
        ),
        true,
        'class_23.method_942 fallback must reset cache height to 512'
    );
}

function assertClass33LevelCompleteSafeBitmapData(swfPath: string): void {
    const { abc, methodBody, instructions } = getInstanceMethodCode(swfPath, 'class_33', 'method_298');

    const constructorIndex = instructions.findIndex((instruction, index) =>
            instruction.opcode === 0x5d &&
            u30OperandName(instruction, abc.multinameNames) === 'BitmapData' &&
            instructions[index + 1]?.opcode === 0xd2 &&
            instructions[index + 2]?.opcode === 0xd3 &&
            instructions[index + 3]?.opcode === 0x26 &&
            instructions[index + 4]?.opcode === 0x24 &&
            instructions[index + 4]?.operands[0]?.[1] === 0 &&
            instructions[index + 5]?.opcode === 0x4a &&
            u30OperandName(instructions[index + 5], abc.multinameNames) === 'BitmapData' &&
            instructions[index + 5]?.operands[1]?.[1] === 4
    );

    assert.notEqual(
        constructorIndex,
        -1,
        'class_33.method_298 cached UI BitmapData allocation must use clamped dynamic dimensions'
    );

    assert.equal(
        instructions.some((instruction, index) =>
            instruction.opcode === 0x60 &&
            u30OperandName(instruction, abc.multinameNames) === 'Math' &&
            instructions[index + 1]?.opcode === 0xd2 &&
            instructions[index + 2]?.opcode === 0x25 &&
            instructions[index + 2]?.operands[0]?.[1] === MAX_CLASS33_CACHE_BITMAP_WIDTH &&
            instructions[index + 3]?.opcode === 0x46 &&
            u30OperandName(instructions[index + 3], abc.multinameNames) === 'min' &&
            instructions[index + 6]?.opcode === 0x60 &&
            u30OperandName(instructions[index + 6], abc.multinameNames) === 'Math' &&
            instructions[index + 7]?.opcode === 0xd3 &&
            instructions[index + 8]?.opcode === 0x25 &&
            instructions[index + 8]?.operands[0]?.[1] === MAX_CLASS33_CACHE_BITMAP_HEIGHT &&
            instructions[index + 9]?.opcode === 0x46 &&
            u30OperandName(instructions[index + 9], abc.multinameNames) === 'min'
        ),
        true,
        'class_33.method_298 cached UI BitmapData dimensions must be clamped without enlarging small hit boxes'
    );

    const construct = instructions[constructorIndex + 5];
    const errorName = abc.multinameNames.findIndex((name) => name === 'Error');
    assert.notEqual(errorName, -1, 'Error multiname not found');
    assert.equal(
        methodBody.exceptions.some((entry) =>
            entry.from <= instructions[constructorIndex].offset &&
            entry.to >= construct.offset + construct.size &&
            entry.type === errorName &&
            entry.target > construct.offset
        ),
        true,
        'class_33.method_298 BitmapData allocation must be caught so cached UI screens cannot crash'
    );
}

function assertGameMethod1947SafeScreenBitmapData(swfPath: string): void {
    const { abc, methodBody, instructions } = getInstanceMethodCode(swfPath, 'Game', 'method_1947');
    const constructorIndex = instructions.findIndex((instruction, index) =>
        instruction.opcode === 0x5d &&
        u30OperandName(instruction, abc.multinameNames) === 'BitmapData' &&
        instructions[index + 1]?.opcode === 0x25 &&
        instructions[index + 1]?.operands[0]?.[1] === SAFE_SCREEN_BITMAP_WIDTH &&
        instructions[index + 2]?.opcode === 0x25 &&
        instructions[index + 2]?.operands[0]?.[1] === SAFE_SCREEN_BITMAP_HEIGHT
    );

    assert.notEqual(
        constructorIndex,
        -1,
        'Game.method_1947 screen BitmapData allocation must use safe fixed dimensions'
    );

    const construct = instructions.find((instruction, index) =>
        index > constructorIndex &&
        instruction.opcode === 0x4a &&
        u30OperandName(instruction, abc.multinameNames) === 'BitmapData' &&
        instruction.operands[1]?.[1] === 3
    );
    assert.ok(construct, 'Game.method_1947 screen BitmapData constructor call not found');

    const errorName = abc.multinameNames.findIndex((name) => name === 'Error');
    assert.notEqual(errorName, -1, 'Error multiname not found');
    assert.equal(
        methodBody.exceptions.some((entry) =>
            entry.from <= instructions[constructorIndex].offset &&
            entry.to >= construct.offset + construct.size &&
            entry.type === errorName &&
            entry.target > construct.offset
        ),
        true,
        'Game.method_1947 screen BitmapData allocation must be caught so door transitions cannot crash'
    );

    assert.equal(
        instructions.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            instructions[index + 1]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 1], abc.multinameNames) === 'main' &&
            instructions[index + 2]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 2], abc.multinameNames) === 'var_374' &&
            instructions[index + 3]?.opcode === 0x2a &&
            instructions[index + 4]?.opcode === 0x11 &&
            instructions[index + 5]?.opcode === 0x29 &&
            instructions[index + 6]?.opcode === 0x10 &&
            instructions[index + 7]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 7], abc.multinameNames) === 'parent' &&
            instructions[index + 8]?.opcode === 0xd0 &&
            instructions[index + 9]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 9], abc.multinameNames) === 'main'
        ),
        true,
        'Game.method_1947 must guard getChildIndex when the transition anchor is no longer a child'
    );

    assert.equal(
        instructions.some((instruction, index) =>
            instruction.opcode === 0xd0 &&
            instructions[index + 1]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 1], abc.multinameNames) === 'main' &&
            instructions[index + 2]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 2], abc.multinameNames) === 'var_374' &&
            instructions[index + 3]?.opcode === 0x2a &&
            instructions[index + 4]?.opcode === 0x11 &&
            instructions[index + 5]?.opcode === 0x29 &&
            instructions[index + 6]?.opcode === 0x10 &&
            instructions[index + 7]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 7], abc.multinameNames) === 'parent' &&
            instructions[index + 8]?.opcode === 0xd0 &&
            instructions[index + 9]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 9], abc.multinameNames) === 'main' &&
            instructions[index + 10]?.opcode === 0xab &&
            instructions[index + 11]?.opcode === 0x12 &&
            instructions.some((candidate, candidateIndex) =>
                candidateIndex > index + 11 &&
                candidateIndex <= index + 40 &&
                candidate.opcode === 0x4f &&
                u30OperandName(candidate, abc.multinameNames) === 'removeChild' &&
                candidate.operands[1]?.[1] === 1
            )
        ),
        true,
        'Game.method_1947 must guard removeChild when the transition snapshot is no longer attached'
    );
}

function assertMainMethod561DoesNotClampMaxScale(swfPath: string): void {
    const { instructions } = getInstanceMethodCode(swfPath, 'Main', 'method_561');
    const maxScaleAssignment = instructions.find((instruction, index) =>
        instruction.opcode === 0x2f &&
        instructions[index + 1]?.opcode === 0x75 &&
        instructions[index + 2]?.opcode === 0xd7 &&
        instructions[index + 3]?.opcode === 0xd3 &&
        instructions[index + 4]?.opcode === 0x2f &&
        instructions[index + 5]?.opcode === 0x0c
    );

    assert.equal(
        maxScaleAssignment,
        undefined,
        'Main.method_561 must not clamp centered fullscreen scale back to 1.25'
    );
}

function assertSuperAnimMethod200BitmapDataGuard(swfPath: string): void {
    assertBitmapDataGuardWindow(swfPath, 10, 11, 'SuperAnimData.method_200 direct allocation');
    assertBitmapDataGuardWindow(swfPath, 25, 26, 'SuperAnimData.method_200 cropped allocation');

    const { abc, instructions } = getStaticMethodCode(swfPath, 'SuperAnimData', 'method_200');
    assert.equal(
        instructions.some((instruction, index) =>
            getLocalOperand(instruction) === 1 &&
            instructions[index + 1]?.opcode === 0x66 &&
            u30OperandName(instructions[index + 1], abc.multinameNames) === 'parent' &&
            instructions[index + 2]?.opcode === 0x60 &&
            u30OperandName(instructions[index + 2], abc.multinameNames) === 'tf' &&
            instructions[index + 3]?.opcode === 0xab &&
            instructions[index + 4]?.opcode === 0x12 &&
            instructions[index + 5]?.opcode === 0x60 &&
            u30OperandName(instructions[index + 5], abc.multinameNames) === 'tf' &&
            getLocalOperand(instructions[index + 6]) === 1 &&
            instructions[index + 7]?.opcode === 0x4f &&
            u30OperandName(instructions[index + 7], abc.multinameNames) === 'removeChild'
        ),
        true,
        'SuperAnimData.method_200 must only remove rendered gear bitmaps when they are still children of tf'
    );
}

function assertSuperAnimMethod806FullscreenBitmapData(swfPath: string): void {
    const { abc, instructions } = getStaticMethodCode(swfPath, 'SuperAnimData', 'method_806');
    const forcedEntityBitmapCount = instructions.filter((instruction, index) =>
        instruction.opcode === 0x5d &&
        u30OperandName(instruction, abc.multinameNames) === 'BitmapData' &&
        instructions[index + 1]?.opcode === 0x25 &&
        instructions[index + 1]?.operands[0]?.[1] === SUPERANIM_METHOD806_FULLSCREEN_ENTITY_BITMAP_SIZE &&
        instructions[index + 2]?.opcode === 0x25 &&
        instructions[index + 2]?.operands[0]?.[1] === SUPERANIM_METHOD806_FULLSCREEN_ENTITY_BITMAP_SIZE &&
        instructions[index + 3]?.opcode === 0x26 &&
        instructions[index + 4]?.opcode === 0x24 &&
        instructions[index + 4]?.operands[0]?.[1] === 0 &&
        instructions[index + 5]?.opcode === 0x4a &&
        u30OperandName(instructions[index + 5], abc.multinameNames) === 'BitmapData' &&
        instructions[index + 5]?.operands[1]?.[1] === 4
    ).length;

    assert.equal(
        forcedEntityBitmapCount,
        2,
        'SuperAnimData.method_806 fullscreen entity BitmapData allocations must use safe fixed dimensions'
    );
}

function assertSuperAnimMethod982BitmapDataGuard(swfPath: string): void {
    const { abc, instructions } = getStaticMethodCode(swfPath, 'SuperAnimData', 'method_982');
    const widthLocal = 11;
    const heightLocal = 12;
    const constructorIndex = findBitmapDataConstructorIndex(
        instructions,
        abc.multinameNames,
        widthLocal,
        heightLocal
    );
    assert.notEqual(constructorIndex, -1, 'SuperAnimData.method_982 output BitmapData constructor not found');

    const guardWindow = instructions.slice(Math.max(0, constructorIndex - 55), constructorIndex);
    assert.equal(
        guardWindow.some((instruction, index) => {
            const pushIntOperand = guardWindow[index + 3]?.operands[0];
            return (
                getLocalOperand(instruction) === widthLocal &&
                getLocalOperand(guardWindow[index + 1]) === heightLocal &&
                guardWindow[index + 2]?.opcode === 0xa2 &&
                guardWindow[index + 3]?.opcode === 0x2d &&
                pushIntOperand?.[0] === 'u30' &&
                abc.intValues[pushIntOperand[1]] === SUPERANIM_METHOD982_SAFE_PIXELS &&
                guardWindow[index + 4]?.opcode === 0xaf
            );
        }),
        true,
        'SuperAnimData.method_982 must enforce the safe output BitmapData total pixel limit'
    );
    assert.equal(
        guardWindow.filter((instruction) => instruction.opcode === 0x25 && instruction.operands[0]?.[1] === SUPERANIM_METHOD982_SAFE_AXIS).length >= 2,
        true,
        'SuperAnimData.method_982 must enforce the safe output BitmapData axis limit'
    );
    assert.equal(
        guardWindow.filter((instruction) => instruction.opcode === 0x24 && instruction.operands[0]?.[1] === 1).length >= 2,
        true,
        'SuperAnimData.method_982 unsafe fallback must collapse to a 1x1 BitmapData instead of live sprite artifacts'
    );
}

function assertSuperAnimMethod866LiveFallbackCleanup(swfPath: string): void {
    const { abc, instructions } = getInstanceMethodCode(swfPath, 'SuperAnimData', 'method_866');

    assert.equal(
        instructions.some((instruction, index) =>
            getLocalOperand(instruction) === 11 &&
            instructions[index + 1]?.opcode === 0x11 &&
            getLocalOperand(instructions[index + 2]) === 4 &&
            instructions[index + 3]?.opcode === 0x20 &&
            instructions[index + 4]?.opcode === 0x61 &&
            u30OperandName(instructions[index + 4], abc.multinameNames) === 'bitmapData'
        ),
        true,
        'SuperAnimData.method_866 must clear stale Bitmap.bitmapData when method_982 falls back to live sprites'
    );
}

function withTempSwf(buffer: Buffer, callback: (tempPath: string) => void): void {
    const tempPath = path.join(os.tmpdir(), `dungeonblitz-variant-${process.pid}-${Date.now()}-${Math.random()}.swf`);
    fs.writeFileSync(tempPath, buffer);
    try {
        callback(tempPath);
    } finally {
        fs.rmSync(tempPath, { force: true });
    }
}

function testLocalVariantUsesLocalhostAndPort8000(): void {
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assert.equal(getStringMatchCount(tempPath, 'localhost'), 1);
        assert.equal(getStringMatchCount(tempPath, ':8000/p/'), 1);
        assert.equal(getStringMatchCount(tempPath, LOCAL_REFRESH_URL), 1);
        assert.equal(getStringMatchCount(tempPath, LEGACY_REFRESH_URL), 0);
        assert.equal(getStringMatchCount(tempPath, MULTIPLAYER_HOST), 0);
        assert.equal(getStringMatchCount(tempPath, '/p/'), 0);
    });
}

function testMultiplayerVariantUsesRemoteHostAndDefaultAssetPath(): void {
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'multiplayer');
    withTempSwf(buffer, (tempPath) => {
        assert.equal(getStringMatchCount(tempPath, MULTIPLAYER_HOST), 1);
        assert.equal(getStringMatchCount(tempPath, '/p/'), 1);
        assert.equal(getStringMatchCount(tempPath, MULTIPLAYER_REFRESH_URL), 1);
        assert.equal(getStringMatchCount(tempPath, LEGACY_REFRESH_URL), 0);
        assert.equal(getStringMatchCount(tempPath, 'localhost'), 0);
        assert.equal(getStringMatchCount(tempPath, ':8000/p/'), 0);
    });
}

function testVariantRemovesDungeonMountSpeedGate(): void {
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assert.equal(getMountedSpeedBranchOpcode(tempPath), -1);
    });
}

function testBaseAndLocalVariantKeepSuperAnimMethod200BitmapDataGuard(): void {
    assertSuperAnimMethod200BitmapDataGuard(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertSuperAnimMethod200BitmapDataGuard(tempPath);
    });
}

function testBaseAndLocalVariantKeepClass82BitmapDataGuard(): void {
    assertClass82BitmapDataGuardWindow(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertClass82BitmapDataGuardWindow(tempPath);
    });
}

function testBaseAndLocalVariantKeepClass23BitmapDataGuard(): void {
    assertClass23BitmapDataGuardWindow(BASE_SWF_PATH);
    assertClass33LevelCompleteSafeBitmapData(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertClass23BitmapDataGuardWindow(tempPath);
        assertClass33LevelCompleteSafeBitmapData(tempPath);
    });
}

function testBaseAndLocalVariantKeepSuperAnimMethod982BitmapDataGuard(): void {
    assertSuperAnimMethod982BitmapDataGuard(BASE_SWF_PATH);
    assertSuperAnimMethod866LiveFallbackCleanup(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertSuperAnimMethod982BitmapDataGuard(tempPath);
        assertSuperAnimMethod866LiveFallbackCleanup(tempPath);
    });
}

function testBaseAndLocalVariantKeepSuperAnimMethod806FullscreenBitmapData(): void {
    assertSuperAnimMethod806FullscreenBitmapData(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertSuperAnimMethod806FullscreenBitmapData(tempPath);
    });
}

function testBaseAndLocalVariantKeepGameMethod1947SafeScreenBitmapData(): void {
    assertGameMethod1947SafeScreenBitmapData(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertGameMethod1947SafeScreenBitmapData(tempPath);
    });
}

function testBaseAndLocalVariantKeepGameMethod1325SuperAnimCrashGuard(): void {
    assertGameMethod1325SuperAnimCrashGuard(BASE_SWF_PATH);
    assertGameMethod1946RenderCrashGuard(BASE_SWF_PATH);
    assertGameMethod1970EntityUpdateCrashGuard(BASE_SWF_PATH);
    assertGameMethod1070ChatBubbleCrashGuard(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertGameMethod1325SuperAnimCrashGuard(tempPath);
        assertGameMethod1946RenderCrashGuard(tempPath);
        assertGameMethod1970EntityUpdateCrashGuard(tempPath);
        assertGameMethod1070ChatBubbleCrashGuard(tempPath);
    });
}

function testBaseAndLocalVariantKeepEntityMethod900GfxGuard(): void {
    assertEntityMethod900GfxGuard(BASE_SWF_PATH);
    assertEntityMethod853GfxGuard(BASE_SWF_PATH);
    assertEntityMethod511LayerReferenceGuard(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertEntityMethod900GfxGuard(tempPath);
        assertEntityMethod853GfxGuard(tempPath);
        assertEntityMethod511LayerReferenceGuard(tempPath);
    });
}

function testBaseAndLocalVariantKeepMainMethod561UnclampedScale(): void {
    assertMainMethod561DoesNotClampMaxScale(BASE_SWF_PATH);
    const buffer = buildDungeonBlitzSwfVariantBuffer(BASE_SWF_PATH, 'local');
    withTempSwf(buffer, (tempPath) => {
        assertMainMethod561DoesNotClampMaxScale(tempPath);
    });
}

function main(): void {
    testLocalVariantUsesLocalhostAndPort8000();
    testMultiplayerVariantUsesRemoteHostAndDefaultAssetPath();
    testVariantRemovesDungeonMountSpeedGate();
    testBaseAndLocalVariantKeepSuperAnimMethod200BitmapDataGuard();
    testBaseAndLocalVariantKeepClass82BitmapDataGuard();
    testBaseAndLocalVariantKeepClass23BitmapDataGuard();
    testBaseAndLocalVariantKeepSuperAnimMethod806FullscreenBitmapData();
    testBaseAndLocalVariantKeepSuperAnimMethod982BitmapDataGuard();
    testBaseAndLocalVariantKeepGameMethod1947SafeScreenBitmapData();
    testBaseAndLocalVariantKeepGameMethod1325SuperAnimCrashGuard();
    testBaseAndLocalVariantKeepEntityMethod900GfxGuard();
    testBaseAndLocalVariantKeepMainMethod561UnclampedScale();
    console.log('dungeonblitz_swf_variant_regression: ok');
}

main();
