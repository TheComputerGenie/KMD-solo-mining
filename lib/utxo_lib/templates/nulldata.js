// OP_RETURN {data}

const bscript = require('../script')
const types = require('../types')
const typeforce = require('../typeforce')
const OPS = require('../opcodes')

function check(script) {
    const buffer = bscript.compile(script)

    return buffer.length > 1 &&
    buffer[0] === OPS.OP_RETURN
}
check.toJSON = function () {
    return 'null data output' 
}

function encode(data) {
    // Allow arrays types since decompile returns an array too
    typeforce(typeforce.oneOf(types.Buffer, types.Array), data)

    return bscript.compile([OPS.OP_RETURN].concat(data))
}

function decode(buffer) {
    typeforce(check, buffer)

    const chunks = bscript.decompile(buffer)

    chunks.shift()

    return chunks.length === 1 ? chunks[0] : chunks
}

module.exports = {
    output: {
        check: check,
        decode: decode,
        encode: encode
    }
}
