// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const bscript = require('../../script');
const typeforce = require('../../typeforce');

function check(script) {
    const chunks = bscript.decompile(script);

    return chunks.length === 2 &&
        bscript.isCanonicalSignature(chunks[0]) &&
        bscript.isCanonicalPubKey(chunks[1]);
}
check.toJSON = function () {
    return 'pubKeyHash input';
};

function encodeStack(signature, pubKey) {
    typeforce({
        signature: bscript.isCanonicalSignature,
        pubKey: bscript.isCanonicalPubKey
    }, {
        signature: signature,
        pubKey: pubKey
    });

    return [signature, pubKey];
}

function encode(signature, pubKey) {
    return bscript.compile(encodeStack(signature, pubKey));
}

function decodeStack(stack) {
    typeforce(check, stack);

    return {
        signature: stack[0],
        pubKey: stack[1]
    };
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