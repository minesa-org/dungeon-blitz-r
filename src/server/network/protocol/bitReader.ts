export class BitReader {
    private data: Buffer;
    private bitIndex: number = 0;
    private debug: boolean;
    private debugLog: string[] = [];

    constructor(data: Buffer, debug: boolean = false) {
        this.data = Buffer.from(data);
        this.debug = debug;
    }

    public getDebugLog(): string[] {
        return this.debugLog;
    }

    public alignToByte(): void {
        const remainder = this.bitIndex % 8;
        if (remainder !== 0) {
            const skipBits = 8 - remainder;
            for (let i = 0; i < skipBits; i++) {
                this.readBit();
            }
            if (this.debug) {
                this.debugLog.push(`align_to_byte=skipped ${skipBits} bits`);
            }
        }
    }

    public remainingBits(): number {
        const totalBits = this.data.length * 8;
        return Math.max(0, totalBits - this.bitIndex);
    }

    public readBit(): number {
        const byteIndex = Math.floor(this.bitIndex / 8);
        const bitOffset = this.bitIndex & 7;

        if (byteIndex >= this.data.length) {
            throw new Error("Not enough data to read bit");
        }

        const bit = (this.data[byteIndex] >> (7 - bitOffset)) & 1;
        this.bitIndex++;

        if (this.debug) {
            this.debugLog.push(`read_bit=${bit} at bit_index=${this.bitIndex - 1}`);
        }
        return bit;
    }

    public readMethod15(): boolean {
        const bit = this.readBit();
        if (this.debug) {
            this.debugLog.push(`method_15=${Boolean(bit)}`);
        }
        return Boolean(bit);
    }

    public readMethod20(bitCount: number): number {
        let val = 0;
        let bitsRemaining = bitCount;

        while (bitsRemaining > 0) {
            const byteIndex = Math.floor(this.bitIndex / 8);
            const bitOffset = this.bitIndex & 7;
            const bitsLeftInByte = 8 - bitOffset;
            const bitsToRead = Math.min(bitsRemaining, bitsLeftInByte);

            const mask = (1 << bitsToRead) - 1;
            const shift = bitsLeftInByte - bitsToRead;
            const currentByte = this.data[byteIndex];
            const extracted = (currentByte >> shift) & mask;

            val = (val * (1 << bitsToRead)) + extracted; // Using arithmetic shift instead of bitwise-or for building logic just in case, though equivalent for small nums

            this.bitIndex += bitsToRead;
            bitsRemaining -= bitsToRead;

             if (this.debug) {
                this.debugLog.push(
                    `read_method_20: byte_index=${byteIndex}, bit_offset=${bitOffset}, ` +
                    `bits_to_read=${bitsToRead}, extracted=${extracted}, val=${val}`
                );
            }
        }
        return val;
    }

    public readMethod739(): number {
        const sign = this.readBit();
        const prefix = this.readMethod20(3);
        const bitsToUse = (prefix + 1) * 2;
        const magnitude = this.readMethod20(bitsToUse);
        return sign ? -magnitude : magnitude;
    }

    public readMethod4(): number {
        const prefix = this.readMethod20(4);
        const bitsToUse = (prefix + 1) * 2;
        if (this.bitIndex + bitsToUse > this.data.length * 8) {
            throw new Error(`Not enough data to read ${bitsToUse} bits for method_4`);
        }
        const value = this.readMethod20(bitsToUse);
        if (this.debug) {
            this.debugLog.push(`read_method_4=${value}, prefix=${prefix}, bits=${bitsToUse}`);
        }
        return value;
    }

    public readMethod26(): string {
        const length = this.readMethod20(16);
        const raw = Buffer.alloc(length);
        for (let i = 0; i < length; i++) {
            raw[i] = this.readMethod20(8);
        }
        return raw.toString('utf-8');
    }

    public readMethod706(): number {
        const isNegative = Boolean(this.readBit());
        const prefix = this.readMethod20(3);
        const bitLength = (prefix + 1) * 2;
        const value = this.readMethod20(bitLength);
        return isNegative ? -value : value;
    }

    public readMethod6(bitCount: number): number {
        if (this.bitIndex + bitCount > this.data.length * 8) {
             throw new Error(`Not enough data to read ${bitCount} bits for method_6`);
        }
        const value = this.readMethod20(bitCount);
        if (this.debug) {
            this.debugLog.push(`read_method_6=${value}, bits=${bitCount}`);
        }
        return value;
    }

    public readMethod9(): number {
        const prefix = this.readMethod20(4);
        const nBits = (prefix + 1) * 2;
        if (this.bitIndex + nBits > this.data.length * 8) {
            throw new Error(`Not enough data to read ${nBits} bits for method_9`);
        }
        const value = this.readMethod20(nBits);
        if (this.debug) {
            this.debugLog.push(`read_method_9=${value}, prefix=${prefix}, bits=${nBits}`);
        }
        return value;
    }

    public readMethod45(): number {
        const sign = this.readBit();
        if (this.bitIndex + 4 > this.data.length * 8) {
            throw new Error("Not enough data to read method_4 prefix for method_45");
        }
        const magnitude = this.readMethod4();
        const value = sign ? -magnitude : magnitude;
        if (this.debug) {
            this.debugLog.push(`read_method_45=${value}, sign=${sign}, magnitude=${magnitude}`);
        }
        return value;
    }

    public readMethod393(): number {
        const value = this.readMethod20(8);
        if (this.debug) {
            this.debugLog.push(`read_method_393=${value}`);
        }
        return value;
    }

    public readMethod560(): number {
        if (this.bitIndex + 32 > this.data.length * 8) {
            throw new Error("Not enough data to read float");
        }
        const bits = this.readMethod20(32);
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(bits >>> 0); // Ensure unsigned for buffer write
        const floatVal = buf.readFloatBE();
        if (this.debug) {
            this.debugLog.push(`read_method_560=${floatVal}`);
        }
        return floatVal;
    }

    public readMethod13(): string {
        const length = this.readMethod20(16);
        if (this.bitIndex + length * 8 > this.data.length * 8) {
            throw new Error("Not enough data to read string");
        }
        const resultBytes = Buffer.alloc(length);
        for (let i = 0; i < length; i++) {
            resultBytes[i] = this.readMethod20(8);
        }
        return resultBytes.toString('utf-8');
    }

    public readMethod24(): number {
        if (this.bitIndex + 1 > this.data.length * 8) {
            throw new Error("Not enough data to read sign bit for method_24");
        }
        const sign = this.readBit();
        const magnitude = this.readMethod9();
        const value = sign ? -magnitude : magnitude;
        
        if (this.debug) {
            this.debugLog.push(`read_method_24=${value}, sign=${sign}, magnitude=${magnitude}`);
        }
        return value;
    }

    public readMethod309(): number {
        return this.readFloat();
    }

    public readFloat(): number {
         const bits = this.readMethod20(32);
         const buf = Buffer.alloc(4);
         buf.writeUInt32BE(bits >>> 0);
         return buf.readFloatBE();
    }

    public readMethod236(): number {
        const prefix = this.readMethod20(3);
        const bitsToUse = (prefix + 1) * 2;
        if (this.bitIndex + bitsToUse > this.data.length * 8) {
             throw new Error("Not enough data to read method_236 value");
        }
        return this.readMethod20(bitsToUse);
    }
}
