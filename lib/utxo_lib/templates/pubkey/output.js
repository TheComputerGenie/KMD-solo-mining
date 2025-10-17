// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// {pubKey} OP_CHECKSIG

const bscript = require('../../script');
const typeforce = require('../../typeforce');
const OPS = require('../../opcodes');

function check(script) {
    const chunks = bscript.decompile(script);

    return chunks.length === 2 &&
        bscript.isCanonicalPubKey(chunks[0]) &&
        chunks[1] === OPS.OP_CHECKSIG;
}
check.toJSON = function () {
    return 'pubKey output';
};

function encode(pubKey) {
    typeforce(bscript.isCanonicalPubKey, pubKey);

    return bscript.compile([pubKey, OPS.OP_CHECKSIG]);
}

function decode(buffer) {
    const chunks = bscript.decompile(buffer);
    typeforce(check, chunks);

    return chunks[0];
}

module.exports = {
    check: check,
    decode: decode,
    encode: encode
};
