// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const bscript = require('../../script');
const typeforce = require('../../typeforce');

function check(script) {
    const chunks = bscript.decompile(script);

    return chunks.length === 1 &&
        bscript.isCanonicalSignature(chunks[0]);
}
check.toJSON = function () {
    return 'pubKey input';
};

function encodeStack(signature) {
    typeforce(bscript.isCanonicalSignature, signature);
    return [signature];
}

function encode(signature) {
    return bscript.compile(encodeStack(signature));
}

function decodeStack(stack) {
    typeforce(check, stack);
    return stack[0];
}

function decode(buffer) {
    const stack = bscript.decompile(buffer);
    return decodeStack(stack);
}

module.exports = {
    check: check,
    decode: decode,
    decodeStack: decodeStack,
    encode: encode,
    encodeStack: encodeStack
};
