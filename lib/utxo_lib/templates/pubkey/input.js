// {signature}

const bscript = require('../../script')
const typeforce = require('../../typeforce')

function check(script) {
    const chunks = bscript.decompile(script)

    return chunks.length === 1 &&
    bscript.isCanonicalSignature(chunks[0])
}
check.toJSON = function () {
    return 'pubKey input' 
}

function encodeStack(signature) {
    typeforce(bscript.isCanonicalSignature, signature)
    return [signature]
}

function encode(signature) {
    return bscript.compile(encodeStack(signature))
}

function decodeStack(stack) {
    typeforce(check, stack)
    return stack[0]
}

function decode(buffer) {
    const stack = bscript.decompile(buffer)
    return decodeStack(stack)
}

module.exports = {
    check: check,
    decode: decode,
    decodeStack: decodeStack,
    encode: encode,
    encodeStack: encodeStack
}
