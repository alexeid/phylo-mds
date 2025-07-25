// bitset.js - BitSet implementation for efficient clade representation

/**
 * BitSet implementation for efficient representation of clades
 */
export class BitSet {
    constructor(size) {
        this.size = size;
        this.words = new Uint32Array(Math.ceil(size / 32));
    }

    /**
     * Set a bit at the given index
     */
    set(index) {
        if (index < 0 || index >= this.size) {
            throw new Error(`Index ${index} out of bounds`);
        }
        const wordIndex = Math.floor(index / 32);
        const bitIndex = index % 32;
        this.words[wordIndex] |= (1 << bitIndex);
    }

    /**
     * Clear a bit at the given index
     */
    clear(index) {
        if (index < 0 || index >= this.size) {
            throw new Error(`Index ${index} out of bounds`);
        }
        const wordIndex = Math.floor(index / 32);
        const bitIndex = index % 32;
        this.words[wordIndex] &= ~(1 << bitIndex);
    }

    /**
     * Get the value of a bit at the given index
     */
    get(index) {
        if (index < 0 || index >= this.size) {
            throw new Error(`Index ${index} out of bounds`);
        }
        const wordIndex = Math.floor(index / 32);
        const bitIndex = index % 32;
        return (this.words[wordIndex] & (1 << bitIndex)) !== 0;
    }

    /**
     * Set a range of bits
     */
    setRange(start, end) {
        for (let i = start; i < end; i++) {
            this.set(i);
        }
    }

    /**
     * Perform bitwise OR with another BitSet
     */
    or(other) {
        const minWords = Math.min(this.words.length, other.words.length);
        for (let i = 0; i < minWords; i++) {
            this.words[i] |= other.words[i];
        }
    }

    /**
     * Perform bitwise AND with another BitSet
     */
    and(other) {
        const minWords = Math.min(this.words.length, other.words.length);
        for (let i = 0; i < minWords; i++) {
            this.words[i] &= other.words[i];
        }
        // Clear remaining words if this BitSet is longer
        for (let i = minWords; i < this.words.length; i++) {
            this.words[i] = 0;
        }
    }

    /**
     * Perform bitwise XOR with another BitSet
     */
    xor(other) {
        const minWords = Math.min(this.words.length, other.words.length);
        for (let i = 0; i < minWords; i++) {
            this.words[i] ^= other.words[i];
        }
    }

    /**
     * Count the number of set bits (cardinality)
     */
    cardinality() {
        let count = 0;
        for (let i = 0; i < this.words.length; i++) {
            let word = this.words[i];
            // Brian Kernighan's algorithm
            while (word) {
                word &= word - 1;
                count++;
            }
        }
        return count;
    }

    /**
     * Find the index of the next set bit starting from a given position
     */
    nextSetBit(fromIndex) {
        if (fromIndex < 0) {
            throw new Error('fromIndex cannot be negative');
        }
        if (fromIndex >= this.size) {
            return -1;
        }

        let wordIndex = Math.floor(fromIndex / 32);
        let bitIndex = fromIndex % 32;

        // Check current word
        let word = this.words[wordIndex] & (~0 << bitIndex);
        while (word === 0) {
            wordIndex++;
            if (wordIndex >= this.words.length) {
                return -1;
            }
            word = this.words[wordIndex];
            bitIndex = 0;
        }

        // Find the lowest set bit
        const trailingZeros = this.countTrailingZeros(word);
        const result = wordIndex * 32 + trailingZeros;
        return result < this.size ? result : -1;
    }

    /**
     * Count trailing zeros in a 32-bit word
     */
    countTrailingZeros(word) {
        if (word === 0) return 32;
        let count = 0;
        if ((word & 0xFFFF) === 0) { count += 16; word >>>= 16; }
        if ((word & 0xFF) === 0) { count += 8; word >>>= 8; }
        if ((word & 0xF) === 0) { count += 4; word >>>= 4; }
        if ((word & 0x3) === 0) { count += 2; word >>>= 2; }
        if ((word & 0x1) === 0) { count += 1; }
        return count;
    }

    /**
     * Check if this BitSet equals another
     */
    equals(other) {
        if (this.size !== other.size) {
            return false;
        }
        for (let i = 0; i < this.words.length; i++) {
            if (this.words[i] !== other.words[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * Create a copy of this BitSet
     */
    clone() {
        const copy = new BitSet(this.size);
        copy.words.set(this.words);
        return copy;
    }

    /**
     * Clear all bits
     */
    clearAll() {
        this.words.fill(0);
    }

    /**
     * Check if no bits are set
     */
    isEmpty() {
        for (let i = 0; i < this.words.length; i++) {
            if (this.words[i] !== 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Convert to string representation (for use as map key)
     */
    toString() {
        const setBits = [];
        let i = this.nextSetBit(0);
        while (i !== -1) {
            setBits.push(i);
            i = this.nextSetBit(i + 1);
        }
        return setBits.join(',');
    }

    /**
     * Create a BitSet from a string representation
     */
    static fromString(str, size) {
        const bitset = new BitSet(size);
        if (str) {
            const indices = str.split(',').map(s => parseInt(s, 10));
            for (const index of indices) {
                if (!isNaN(index)) {
                    bitset.set(index);
                }
            }
        }
        return bitset;
    }

    /**
     * Create a new BitSet of the given size
     */
    static newBitSet(size) {
        return new BitSet(size);
    }
}