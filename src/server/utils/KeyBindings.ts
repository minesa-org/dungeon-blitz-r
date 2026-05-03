import { BitBuffer } from '../network/protocol/bitBuffer';
import { BitReader } from '../network/protocol/bitReader';

export type SavedKeyBindings = Array<number | null>;

export const KEY_BINDING_COMMAND_COUNT = 26;
export const KEY_BINDING_UNBOUND = 255;

const MAX_KEY_BINDING_PACKET_BYTES = Math.ceil((1 + KEY_BINDING_COMMAND_COUNT + KEY_BINDING_COMMAND_COUNT * 8) / 8);

function isValidKeyCode(value: number): boolean {
    return Number.isInteger(value) && value >= 0 && value <= KEY_BINDING_UNBOUND;
}

function remainingBitsAreZero(br: BitReader): boolean {
    while (br.remainingBits() > 0) {
        if (br.readBit() !== 0) {
            return false;
        }
    }
    return true;
}

export function normalizeSavedKeyBindings(value: unknown): SavedKeyBindings {
    const result: SavedKeyBindings = new Array(KEY_BINDING_COMMAND_COUNT).fill(null);
    if (!Array.isArray(value)) {
        return result;
    }

    for (let index = 0; index < KEY_BINDING_COMMAND_COUNT; index++) {
        const raw = value[index];
        if (raw === null || raw === undefined || raw === false) {
            continue;
        }

        const keyCode = Number(raw);
        if (isValidKeyCode(keyCode)) {
            result[index] = keyCode;
        }
    }

    return result;
}

export function savedKeyBindingsHaveOverrides(bindings: SavedKeyBindings): boolean {
    return bindings.some((keyCode) => keyCode !== null);
}

export function readSavedKeyBindingsPacket(data: Buffer): SavedKeyBindings | null {
    if (data.length < 1 || data.length > MAX_KEY_BINDING_PACKET_BYTES) {
        return null;
    }

    const br = new BitReader(data);
    try {
        const hasCustomBindings = br.readMethod15();
        if (!hasCustomBindings) {
            if (data.length !== 1) {
                return null;
            }
            return remainingBitsAreZero(br) ? new Array(KEY_BINDING_COMMAND_COUNT).fill(null) : null;
        }

        const bindings: SavedKeyBindings = new Array(KEY_BINDING_COMMAND_COUNT).fill(null);
        for (let index = 0; index < KEY_BINDING_COMMAND_COUNT; index++) {
            const hasOverride = br.readMethod15();
            if (!hasOverride) {
                continue;
            }

            const keyCode = br.readMethod393();
            if (!isValidKeyCode(keyCode)) {
                return null;
            }
            bindings[index] = keyCode;
        }

        if (!savedKeyBindingsHaveOverrides(bindings)) {
            return null;
        }

        return remainingBitsAreZero(br) ? bindings : null;
    } catch {
        return null;
    }
}

export function writeSavedKeyBindings(bb: BitBuffer, value: unknown): void {
    const bindings = normalizeSavedKeyBindings(value);
    const hasOverrides = savedKeyBindingsHaveOverrides(bindings);
    bb.writeMethod11(hasOverrides ? 1 : 0, 1);
    if (!hasOverrides) {
        return;
    }

    for (const keyCode of bindings) {
        const hasOverride = keyCode !== null;
        bb.writeMethod11(hasOverride ? 1 : 0, 1);
        if (hasOverride) {
            bb.writeMethod393(keyCode);
        }
    }
}
