function decode(buffer, maxLength, minimal) {
    maxLength = maxLength || 4;
    minimal = minimal === undefined ? true : minimal;

    const length = buffer.length;
    if (length === 0) {
        return 0;
    }
    if (length > maxLength) {
        throw new TypeError('Script number overflow');
    }
    if (minimal) {
        if ((buffer[length - 1] & 0x7f) === 0) {
            if (length <= 1 || (buffer[length - 2] & 0x80) === 0) {
                throw new Error('Non-minimally encoded script number');
            }
        }
    }

    // Use BigInt for cleaner calculation
    let num = global.BigInt(0);
    for (let i = 0; i < length; ++i) {
        num |= global.BigInt(buffer[i]) << global.BigInt(8 * i);
    }

    if (buffer[length - 1] & 0x80) {
    // Negative: clear the sign bit and negate
        const signMask = ~(global.BigInt(0x80) << global.BigInt(8 * (length - 1)));
        num = -(num & signMask);
    }

    return Number(num);
}

function scriptNumSize(i) {
    return i > 0x7fffffff ? 5
        : i > 0x7fffff ? 4
            : i > 0x7fff ? 3
                : i > 0x7f ? 2
                    : i > 0x00 ? 1
                        : 0;
}

function encode(number) {
    let value = global.BigInt(Math.abs(number));
    const size = scriptNumSize(Number(value));
    const buffer = Buffer.allocUnsafe(size);
    const negative = number < 0;

    for (let i = 0; i < size; ++i) {
        buffer.writeUInt8(Number(value & global.BigInt(0xff)), i);
        value >>= global.BigInt(8);
    }

    if (buffer[size - 1] & 0x80) {
        buffer.writeUInt8(negative ? 0x80 : 0x00, size - 1);
    } else if (negative) {
        buffer[size - 1] |= 0x80;
    }

    return buffer;
}

module.exports = {
    decode: decode,
    encode: encode
};
