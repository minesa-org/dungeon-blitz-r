export class BitBuffer {
    private bits: number[] = [];
    private debug: boolean;
    private debugLog: string[] = [];

    constructor(debug: boolean = true) {
        this.debug = debug;
    }

    public getDebugLog(): string[] {
        return this.debugLog;
    }

    public toBuffer(): Buffer {
        // Pad to byte alignment
        while (this.bits.length % 8 !== 0) {
            this.bits.push(0);
            if (this.debug) {
                this.debugLog.push("pad_to_byte=0");
            }
        }

        const out = Buffer.alloc(this.bits.length / 8);
        for (let i = 0; i < this.bits.length; i += 8) {
            let byte = 0;
            for (let j = 0; j < 8; j++) {
                byte = (byte << 1) | this.bits[i + j];
            }
            out[i / 8] = byte;
        }
        return out;
    }

    public writeMethod15(flag: boolean): void {
        this.writeMethod11(flag ? 1 : 0, 1);
        if (this.debug) {
            this.debugLog.push(`method_15=${flag}`);
        }
    }

    public writeMethod20(bitCount: number, value: number): void {
        const initialBitCount = bitCount;
        const initialValue = value;

        // In JS, extensive bit shifting on large numbers can be tricky if we treat them as 32-bit ints.
        // However, standard use case here fits within standard number safety or we deal with it bit by bit.
        // Since we are pushing bit by bit, we can iterate.
        
        // We write from MSB to LSB.
        for (let i = bitCount - 1; i >= 0; i--) {
            const bit = (value >> i) & 1;
            this.bits.push(bit);
        }

        if (this.debug) {
            this.debugLog.push(`write_method_20: value=${initialValue}, bits_written=${initialBitCount}`);
        }
    }

    public writeMethod739(value: number): void {
        if (value < 0) {
            this.writeMethod11(1, 1);
            this.writeMethod91(-value);
        } else {
            this.writeMethod11(0, 1);
            this.writeMethod91(value);
        }
        if (this.debug) {
            this.debugLog.push(`method_739=${value}`);
        }
    }

    public writeMethod4(val: number): void {
        const bitsNeeded = val > 0 ? Math.floor(Math.log2(val)) + 1 : 1;
        // bits_to_use = max(2, (bits_needed + 1) & ~1)
        const bitsToUse = Math.max(2, (bitsNeeded + 1) & ~1);
        const prefix = (bitsToUse / 2) - 1;

        if (prefix < 0 || prefix > 15) {
             throw new Error(`Value too large for method_4: ${val}`);
        }

        this.writeMethod11(prefix, 4);
        this.writeMethod11(val, bitsToUse);

        if (this.debug) {
            this.debugLog.push(`method_4=${val}, prefix=${prefix}, bits=${bitsToUse}`);
        }
    }

    public writeMethod26(val: string | null): void {
        if (val === null) val = "";
        const encoded = Buffer.from(val, 'utf-8');
        const length = Math.min(encoded.length, 65535);

        this.writeMethod11(length, 16);
        for (let i = 0; i < length; i++) {
            this.writeMethod11(encoded[i], 8);
        }

        if (this.debug) {
            this.debugLog.push(`method_26=${val}, length=${length}`);
        }
    }

    public writeMethod6(val: number, bitCount: number): void {
        this.writeMethod11(val, bitCount);
        if (this.debug) {
            this.debugLog.push(`method_6=${val}, bits=${bitCount}`);
        }
    }

    public writeMethod91(val: number): void {
        const bitsNeeded = val > 0 ? Math.floor(Math.log2(val)) + 1 : 1;
        const bitsToUse = Math.max(2, (bitsNeeded + 1) & ~1);
        const n = (bitsToUse / 2) - 1;

        this.writeMethod11(n, 3);
        this.writeMethod11(val, bitsToUse);

        if (this.debug) {
            this.debugLog.push(`method_91=${val}, n=${n}, bits=${bitsToUse}`);
        }
    }

    public writeMethod9(val: number): void {
        let bitLen = val > 0 ? Math.floor(Math.log2(val)) + 1 : 1;
        if (bitLen % 2 !== 0) {
            bitLen += 1;
        }
        const prefix = (bitLen / 2) - 1;
        this.writeMethod11(prefix, 4);
        this.writeMethod11(val, bitLen);
    }

    public writeMethod45(val: number): void {
        if (val < 0) {
            this.writeMethod11(1, 1);
            this.writeMethod4(-val);
        } else {
            this.writeMethod11(0, 1);
            this.writeMethod4(val);
        }
        if (this.debug) {
            this.debugLog.push(`method_45=${val}, sign=${val < 0 ? 1 : 0}`);
        }
    }

    public writeMethod706(val: number): void {
        const sign = val < 0 ? 1 : 0;
        const mag = Math.abs(val);
        let bitsNeeded = mag > 0 ? Math.floor(Math.log2(mag)) + 1 : 1;
        // bitsToUse = (prefix + 1) * 2
        // Must be even, at least 2.
        const bitsToUse = Math.max(2, (bitsNeeded + 1) & ~1);
        const prefix = (bitsToUse / 2) - 1;

        if (prefix > 7) {
             console.error(`Value too large for method_706: ${val}`);
             // Clamp or throw? Let's just write max.
        }

        this.writeMethod11(sign, 1);
        this.writeMethod20(prefix, 3);
        this.writeMethod20(mag, bitsToUse);

        if (this.debug) {
            this.debugLog.push(`method_706=${val}, sign=${sign}, prefix=${prefix}, bits=${bitsToUse}`);
        }
    }

    public writeMethod11(value: number, bitCount: number): void {
        if (this.debug) {
            // value.toString(2) might not show leading zeros, so padStart
            this.debugLog.push(`write_method_6=${value.toString(2).padStart(bitCount, '0')} (${bitCount} bits)`);
        }
        for (let i = bitCount - 1; i >= 0; i--) {
            this.bits.push((value >> i) & 1);
        }
    }

    public writeMethod393(val: number): void {
        this.writeMethod11(val & 0xFF, 8);
    }

    public writeMethod13(...vals: string[]): void {
        const val = vals.join(" ");
        const encoded = Buffer.from(val, 'utf-8');
        const length = Math.min(encoded.length, 65535);

        this.writeMethod11(length, 16);
        for (let i = 0; i < length; i++) {
            this.writeMethod11(encoded[i], 8);
        }

        if (this.debug) {
            this.debugLog.push(`method_13=${val}, length=${length}`);
        }
    }

    public writeFloat(val: number): void {
        const buf = Buffer.alloc(4);
        buf.writeFloatBE(val);
        for (const byte of buf) {
            this.writeMethod11(byte, 8);
        }
    }

    public writeMethod309(val: number): void {
        this.writeFloat(val);
        if (this.debug) {
            this.debugLog.push(`method_309=${val}`);
        }
    }

    public writeMethod24(val: number): void {
        const sign = val < 0 ? 1 : 0;
        this.writeMethod11(sign, 1);
        this.writeMethod9(Math.abs(val));
        if (this.debug) {
            this.debugLog.push(`method_24=${val}, sign=${sign}`);
        }
    }
}
