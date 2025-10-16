const crypto = require('crypto');
const base58 = require('../base58');

// BigInt utility functions
const bufferToBigInt = (buffer, options = {}) => {
    if (!buffer || buffer.length === 0) {
        return 0n;
    }
    const bytes = options.endian === 'little' ? Buffer.from(buffer).reverse() : buffer;
    return BigInt(`0x${bytes.toString('hex')}`);
};

const bigIntToBuffer = (bigint, size = null) => {
    if (bigint === 0n) {
        return size ? Buffer.alloc(size, 0) : Buffer.alloc(1, 0);
    }
    let hex = bigint.toString(16);
    if (hex.length % 2) {
        hex = `0${hex}`;
    }
    let buffer = Buffer.from(hex, 'hex');
    if (size) {
        if (buffer.length > size) {
            buffer = buffer.slice(buffer.length - size);
        } else if (buffer.length < size) {
            const padding = Buffer.alloc(size - buffer.length, 0);
            buffer = Buffer.concat([padding, buffer]);
        }
    }
    return buffer;
};

const safeToNumber = (bigint) => {
    if (bigint > BigInt(Number.MAX_SAFE_INTEGER) || bigint < BigInt(Number.MIN_SAFE_INTEGER)) {
        throw new Error('BigInt value too large to safely convert to Number');
    }
    return Number(bigint);
};

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest();
const sha256d = (buffer) => sha256(sha256(buffer));

const reverseBuffer = (buff) => {
    const len = buff.length;
    if (len <= 1) {
        return Buffer.from(buff);
    }
    const out = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
        out[i] = buff[len - 1 - i];
    }
    return out;
};

const getVersionByte = (addr) => base58.decode(addr).slice(0, 1);

const addressFromEx = (exAddress, ripdm160Key) => {
    try {
        const versionByte = getVersionByte(exAddress);
        const addrBase = Buffer.concat([versionByte, Buffer.from(ripdm160Key, 'hex')]);
        const checksum = sha256d(addrBase).slice(0, 4);
        const address = Buffer.concat([addrBase, checksum]);
        return base58.encode(address);
    } catch (e) {
        return null;
    }
};

const reverseHex = (hex) => reverseBuffer(Buffer.from(hex, 'hex')).toString('hex');

const uint256BufferFromHash = (hex) => {
    const fromHex = Buffer.from(hex, 'hex');
    if (fromHex.length === 32) {
        return reverseBuffer(fromHex);
    }
    const empty = Buffer.alloc(32, 0);
    fromHex.copy(empty);
    return reverseBuffer(empty);
};

const varIntBuffer = (n) => {
    if (n < 0xfd) {
        return Buffer.from([n]);
    }
    if (n < 0x10000) {
        const buff = Buffer.alloc(3);
        buff[0] = 0xfd;
        buff.writeUInt16LE(n, 1);
        return buff;
    }
    if (n < 0x100000000) {
        const buff = Buffer.alloc(5);
        buff[0] = 0xfe;
        buff.writeUInt32LE(n, 1);
        return buff;
    }
    const buff = Buffer.alloc(9);
    buff[0] = 0xff;
    packUInt64LE(n).copy(buff, 1);
    return buff;
};

const varStringBuffer = (string) => {
    const strBuff = Buffer.from(string);
    return Buffer.concat([varIntBuffer(strBuff.length), strBuff]);
};

const serializeNumber = (n) => {
    if (n >= 1 && n <= 16) {
        return Buffer.from([0x50 + n]);
    }
    let l = 1;
    const buff = Buffer.alloc(9);
    while (n > 0x7f) {
        buff.writeUInt8(n & 0xff, l++);
        n >>= 8;
    }
    buff.writeUInt8(l, 0);
    buff.writeUInt8(n, l++);
    return buff.slice(0, l);
};

const packUInt16LE = (num) => {
    const buff = Buffer.alloc(2);
    buff.writeUInt16LE(num, 0);
    return buff;
};

const packInt32LE = (num) => {
    const buff = Buffer.alloc(4);
    buff.writeInt32LE(num, 0);
    return buff;
};

const packInt32BE = (num) => {
    const buff = Buffer.alloc(4);
    buff.writeInt32BE(num, 0);
    return buff;
};

const packUInt32LE = (num) => {
    const buff = Buffer.alloc(4);
    buff.writeUInt32LE(num, 0);
    return buff;
};

const packUInt32BE = (num) => {
    const buff = Buffer.alloc(4);
    buff.writeUInt32BE(num, 0);
    return buff;
};

const packUInt64LE = (num) => {
    const buff = Buffer.alloc(8);
    const high = Math.floor(num / 0x100000000);
    const low = num & 0xffffffff;
    buff.writeUInt32LE(low, 0);
    buff.writeUInt32LE(high, 4);
    return buff;
};

const packInt64LE = packUInt64LE;

const getReadableHashRateString = (hashrate) => {
    hashrate = parseFloat(hashrate);
    if (hashrate < 1000) {
        return `${hashrate.toFixed(2)} H/s`;
    }
    if (hashrate < 1000000) {
        return `${(hashrate / 1000).toFixed(2)} kH/s`;
    }
    if (hashrate < 1000000000) {
        return `${(hashrate / 1000000).toFixed(2)} MH/s`;
    }
    if (hashrate < 1000000000000) {
        return `${(hashrate / 1000000000).toFixed(2)} GH/s`;
    }
    return `${(hashrate / 1000000000000).toFixed(2)} TH/s`;
};

const getReadableNetworkStatString = (stat) => {
    if (stat < 1000) {
        return stat.toFixed(2);
    }
    if (stat < 1000000) {
        return `${(stat / 1000).toFixed(2)} K`;
    }
    if (stat < 1000000000) {
        return `${(stat / 1000000).toFixed(2)} M`;
    }
    return `${(stat / 1000000000).toFixed(2)} G`;
};

const addressToScript = (addr) => {
    const decoded = base58.decode(addr);
    return decoded.slice(1, 21);
};

module.exports = {
    bufferToBigInt,
    bigIntToBuffer,
    safeToNumber,
    addressFromEx,
    getVersionByte,
    sha256,
    sha256d,
    reverseBuffer,
    reverseHex,
    uint256BufferFromHash,
    varIntBuffer,
    varStringBuffer,
    serializeNumber,
    packUInt16LE,
    packInt32LE,
    packInt32BE,
    packUInt32LE,
    packUInt32BE,
    packUInt64LE,
    packInt64LE,
    getReadableHashRateString,
    getReadableNetworkStatString,
    addressToScript
};
