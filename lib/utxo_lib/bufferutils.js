// Native VarInt implementation
function varIntEncodingLength(number) {
    if (number < 0xfd) {
        return 1
    }
    if (number <= 0xffff) {
        return 3
    }
    if (number <= 0xffffffff) {
        return 5
    }
    return 9
}

function varIntEncode(number, buffer, offset) {
    if (!buffer) {
        buffer = Buffer.allocUnsafe(varIntEncodingLength(number))
    }
    if (!offset) {
        offset = 0
    }

    if (number < 0xfd) {
        buffer.writeUInt8(number, offset)
        varIntEncode.bytes = 1
    } else if (number <= 0xffff) {
        buffer.writeUInt8(0xfd, offset)
        buffer.writeUInt16LE(number, offset + 1)
        varIntEncode.bytes = 3
    } else if (number <= 0xffffffff) {
        buffer.writeUInt8(0xfe, offset)
        buffer.writeUInt32LE(number, offset + 1)
        varIntEncode.bytes = 5
    } else {
        buffer.writeUInt8(0xff, offset)
        buffer.writeBigUInt64LE(global.BigInt(number), offset + 1)
        varIntEncode.bytes = 9
    }

    return buffer
}

function varIntDecode(buffer, offset) {
    if (!offset) {
        offset = 0
    }

    const first = buffer.readUInt8(offset)
    if (first < 0xfd) {
        varIntDecode.bytes = 1
        return first
    } else if (first === 0xfd) {
        varIntDecode.bytes = 3
        return buffer.readUInt16LE(offset + 1)
    } else if (first === 0xfe) {
        varIntDecode.bytes = 5
        return buffer.readUInt32LE(offset + 1)
    } else {
        varIntDecode.bytes = 9
        return Number(buffer.readBigUInt64LE(offset + 1))
    }
}

// Native PushData implementation
function pushDataEncodingLength(length) {
    if (length < 0x4c) {
        return 1
    }
    if (length <= 0xff) {
        return 2
    }
    if (length <= 0xffff) {
        return 3
    }
    if (length <= 0xffffffff) {
        return 5
    }
    throw new Error('Data too long to encode in a pushdata op')
}

function pushDataEncode(data, buffer, offset) {
    const length = data.length
    const encodingLength = pushDataEncodingLength(length)

    if (!buffer) {
        buffer = Buffer.allocUnsafe(encodingLength + length)
    }
    if (!offset) {
        offset = 0
    }

    if (length < 0x4c) {
        buffer.writeUInt8(length, offset)
        pushDataEncode.bytes = 1
    } else if (length <= 0xff) {
        buffer.writeUInt8(0x4c, offset)
        buffer.writeUInt8(length, offset + 1)
        pushDataEncode.bytes = 2
    } else if (length <= 0xffff) {
        buffer.writeUInt8(0x4d, offset)
        buffer.writeUInt16LE(length, offset + 1)
        pushDataEncode.bytes = 3
    } else {
        buffer.writeUInt8(0x4e, offset)
        buffer.writeUInt32LE(length, offset + 1)
        pushDataEncode.bytes = 5
    }

    data.copy(buffer, offset + pushDataEncode.bytes)
    return buffer
}

function pushDataDecode(buffer, offset) {
    if (!offset) {
        offset = 0
    }

    const opcode = buffer.readUInt8(offset)
    let length, dataOffset

    if (opcode < 0x4c) {
        length = opcode
        dataOffset = offset + 1
        pushDataDecode.bytes = 1 + length
    } else if (opcode === 0x4c) {
        length = buffer.readUInt8(offset + 1)
        dataOffset = offset + 2
        pushDataDecode.bytes = 2 + length
    } else if (opcode === 0x4d) {
        length = buffer.readUInt16LE(offset + 1)
        dataOffset = offset + 3
        pushDataDecode.bytes = 3 + length
    } else if (opcode === 0x4e) {
        length = buffer.readUInt32LE(offset + 1)
        dataOffset = offset + 5
        pushDataDecode.bytes = 5 + length
    } else {
        throw new Error('Invalid pushdata opcode: ' + opcode)
    }

    return buffer.slice(dataOffset, dataOffset + length)
}

function readUInt64LE(buffer, offset) {
    return Number(buffer.readBigUInt64LE(offset))
}

function readInt64LE(buffer, offset) {
    return Number(buffer.readBigInt64LE(offset))
}

function writeUInt64LE(buffer, value, offset) {
    if (typeof value === 'number') {
        value = global.BigInt(value)
    }
    buffer.writeBigUInt64LE(value, offset)
    return offset + 8
}

// TODO: remove in 4.0.0?
function readVarInt(buffer, offset) {
    const result = varIntDecode(buffer, offset)

    return {
        number: result,
        size: varIntDecode.bytes
    }
}

// TODO: remove in 4.0.0?
function writeVarInt(buffer, number, offset) {
    varIntEncode(number, buffer, offset)
    return varIntEncode.bytes
}

module.exports = {
    pushDataSize: pushDataEncodingLength,
    readPushDataInt: pushDataDecode,
    readUInt64LE: readUInt64LE,
    readInt64LE: readInt64LE,
    readVarInt: readVarInt,
    varIntBuffer: varIntEncode,
    varIntSize: varIntEncodingLength,
    writePushDataInt: writePushDataInt,
    writeUInt64LE: writeUInt64LE,
    writeVarInt: writeVarInt
}

function writePushDataInt(data, buffer, offset) {
    const length = data.length
    let bytes = 0

    if (length < 0x4c) {
        buffer.writeUInt8(length, offset)
        bytes = 1
    } else if (length <= 0xff) {
        buffer.writeUInt8(0x4c, offset)
        buffer.writeUInt8(length, offset + 1)
        bytes = 2
    } else if (length <= 0xffff) {
        buffer.writeUInt8(0x4d, offset)
        buffer.writeUInt16LE(length, offset + 1)
        bytes = 3
    } else if (length <= 0xffffffff) {
        buffer.writeUInt8(0x4e, offset)
        buffer.writeUInt32LE(length, offset + 1)
        bytes = 5
    } else {
        throw new Error('Data too large for pushdata')
    }

    data.copy(buffer, offset + bytes)
    writePushDataInt.bytes = bytes + length  // Include data length in total bytes
    return buffer
}
