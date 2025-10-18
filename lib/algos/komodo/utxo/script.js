// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const bufferutils = require('./bufferutils');
const types = require('./types');
const scriptNumber = require('./script_number');

// Native typeforce replacement
function typeforce(validator, value, allowIncomplete) {
    if (typeof validator === 'function') {
        // Convert arguments object to array if needed (but not Buffers or other objects with length)
        let testValue = value;
        if (value && typeof value === 'object' && typeof value.length === 'number' &&
            !Array.isArray(value) && !Buffer.isBuffer(value) &&
            Object.prototype.toString.call(value) === '[object Arguments]') {
            testValue = Array.prototype.slice.call(value);
        }

        if (!validator(testValue)) {
            throw new TypeError(`Expected ${validator.name || 'valid type'}`);
        }
    } else if (Array.isArray(validator)) {
        if (!Array.isArray(value)) {
            throw new TypeError('Expected array');
        }
        for (let i = 0; i < validator.length && i < value.length; i++) {
            if (!allowIncomplete || value[i] !== undefined) {
                typeforce(validator[i], value[i], allowIncomplete);
            }
        }
    }
    return value;
}

const OPS = require('./opcodes');
// Create reverse mapping for opcodes
const REVERSE_OPS = {};
for (const key in OPS) {
    REVERSE_OPS[OPS[key]] = key;
}
const OP_INT_BASE = OPS.OP_RESERVED; // OP_1 - 1

function isOPInt(value) {
    return types.Number(value) &&
        ((value === OPS.OP_0) ||
            (value >= OPS.OP_1 && value <= OPS.OP_16) ||
            (value === OPS.OP_1NEGATE));
}

function isPushOnlyChunk(value) {
    return types.Buffer(value) || isOPInt(value);
}

function isPushOnly(value) {
    return types.Array(value) && value.every(isPushOnlyChunk);
}

function asMinimalOP(buffer) {
    if (buffer.length === 0) {
        return OPS.OP_0;
    }
    if (buffer.length !== 1) {
        return;
    }
    if (buffer[0] >= 1 && buffer[0] <= 16) {
        return OP_INT_BASE + buffer[0];
    }
    if (buffer[0] === 0x81) {
        return OPS.OP_1NEGATE;
    }
}

function compile(chunks) {
    if (Buffer.isBuffer(chunks)) {
        return chunks;
    }

    typeforce(types.Array, chunks);

    const bufferSize = chunks.reduce((accum, chunk) => {
        // data chunk
        if (Buffer.isBuffer(chunk)) {
            // adhere to BIP62.3, minimal push policy
            if (chunk.length === 1 && asMinimalOP(chunk) !== undefined) {
                return accum + 1;
            }

            return accum + bufferutils.pushDataSize(chunk.length) + chunk.length;
        }

        // opcode
        return accum + 1;
    }, 0.0);

    const buffer = Buffer.allocUnsafe(bufferSize);
    let offset = 0;

    chunks.forEach((chunk) => {
        // data chunk
        if (Buffer.isBuffer(chunk)) {
            // adhere to BIP62.3, minimal push policy
            const opcode = asMinimalOP(chunk);
            if (opcode !== undefined) {
                buffer.writeUInt8(opcode, offset);
                offset += 1;
                return;
            }

            bufferutils.writePushDataInt(chunk, buffer, offset);
            offset += bufferutils.writePushDataInt.bytes;

            // opcode
        } else {
            buffer.writeUInt8(chunk, offset);
            offset += 1;
        }
    });

    if (offset !== buffer.length) {
        throw new Error('Could not decode chunks');
    }
    return buffer;
}

function decompile(buffer) {
    if (types.Array(buffer)) {
        return buffer;
    }

    typeforce(types.Buffer, buffer);

    const chunks = [];
    let i = 0;

    while (i < buffer.length) {
        const opcode = buffer[i];

        // data chunk
        if ((opcode > OPS.OP_0) && (opcode <= OPS.OP_PUSHDATA4)) {
            const data = bufferutils.readPushDataInt(buffer, i);

            // did reading a pushDataInt fail? empty script
            if (data === null) {
                return [];
            }
            i += bufferutils.readPushDataInt.bytes;

            // attempt to read too much data? empty script
            if (i + data.length > buffer.length) {
                return [];
            }

            i += data.length;

            // decompile minimally
            const op = asMinimalOP(data);
            if (op !== undefined) {
                chunks.push(op);
            } else {
                chunks.push(data);
            }

            // opcode
        } else {
            chunks.push(opcode);

            i += 1;
        }
    }

    return chunks;
}

function toASM(chunks) {
    if (Buffer.isBuffer(chunks)) {
        chunks = decompile(chunks);
    }

    return chunks.map((chunk) => {
        // data?
        if (Buffer.isBuffer(chunk)) {
            const op = asMinimalOP(chunk);
            if (op === undefined) {
                return chunk.toString('hex');
            }
            chunk = op;
        }

        // opcode!
        return REVERSE_OPS[chunk];
    }).join(' ');
}

function fromASM(asm) {
    typeforce(types.String, asm);

    return compile(asm.split(' ').map((chunkStr) => {
        // opcode?
        if (OPS[chunkStr] !== undefined) {
            return OPS[chunkStr];
        }
        typeforce(types.Hex, chunkStr);

        // data!
        return Buffer.from(chunkStr, 'hex');
    }));
}

function toStack(chunks) {
    chunks = decompile(chunks);
    typeforce(isPushOnly, chunks);

    return chunks.map((op) => {
        if (Buffer.isBuffer(op)) {
            return op;
        }
        if (op === OPS.OP_0) {
            return Buffer.allocUnsafe(0);
        }

        return scriptNumber.encode(op - OP_INT_BASE);
    });
}

function isCanonicalPubKey(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        return false;
    }
    if (buffer.length < 33) {
        return false;
    }

    switch (buffer[0]) {
    case 0x02:
    case 0x03:
        return buffer.length === 33;
    case 0x04:
        return buffer.length === 65;
    }

    return false;
}

function isDefinedHashType(hashType) {
    const hashTypeMod = hashType & ~0xc0;

    // return hashTypeMod > SIGHASH_ALL && hashTypeMod < SIGHASH_SINGLE
    return hashTypeMod > 0x00 && hashTypeMod < 0x04;
}

// Native BIP66 DER signature validation
function isDERSignature(buffer) {
    if (buffer.length < 8) {
        return false;
    }
    if (buffer.length > 72) {
        return false;
    }
    if (buffer[0] !== 0x30) {
        return false;
    }

    const length = buffer[1];
    if (length !== buffer.length - 2) {
        return false;
    }

    const rOffset = 2;
    if (buffer[rOffset] !== 0x02) {
        return false;
    }

    const rLength = buffer[rOffset + 1];
    if (rLength === 0) {
        return false;
    }
    if (rOffset + rLength + 2 >= buffer.length) {
        return false;
    }
    if (buffer[rOffset + 2] & 0x80) {
        return false;
    }
    if (rLength > 1 && buffer[rOffset + 2] === 0x00 && !(buffer[rOffset + 3] & 0x80)) {
        return false;
    }

    const sOffset = rOffset + rLength + 2;
    if (buffer[sOffset] !== 0x02) {
        return false;
    }

    const sLength = buffer[sOffset + 1];
    if (sLength === 0) {
        return false;
    }
    if (sOffset + sLength + 2 !== buffer.length) {
        return false;
    }
    if (buffer[sOffset + 2] & 0x80) {
        return false;
    }
    if (sLength > 1 && buffer[sOffset + 2] === 0x00 && !(buffer[sOffset + 3] & 0x80)) {
        return false;
    }

    return true;
}

function isCanonicalSignature(buffer) {
    if (!Buffer.isBuffer(buffer)) {
        return false;
    }
    if (!isDefinedHashType(buffer[buffer.length - 1])) {
        return false;
    }

    return isDERSignature(buffer.slice(0, -1));
}

module.exports = {
    compile: compile,
    decompile: decompile,
    fromASM: fromASM,
    toASM: toASM,
    toStack: toStack,

    number: require('./script_number'),

    isCanonicalPubKey: isCanonicalPubKey,
    isCanonicalSignature: isCanonicalSignature,
    isPushOnly: isPushOnly,
    isDefinedHashType: isDefinedHashType
};