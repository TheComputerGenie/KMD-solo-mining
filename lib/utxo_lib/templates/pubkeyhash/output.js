// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// OP_DUP OP_HASH160 {pubKeyHash} OP_EQUALVERIFY OP_CHECKSIG

const bscript = require('../../script');
const types = require('../../types');
const typeforce = require('../../typeforce');
const OPS = require('../../opcodes');

function check(script) {
    const buffer = bscript.compile(script);

    return buffer.length === 25 &&
        buffer[0] === OPS.OP_DUP &&
        buffer[1] === OPS.OP_HASH160 &&
        buffer[2] === 0x14 &&
        buffer[23] === OPS.OP_EQUALVERIFY &&
        buffer[24] === OPS.OP_CHECKSIG;
}
check.toJSON = function () {
    return 'pubKeyHash output';
};

function encode(pubKeyHash) {
    typeforce(types.Hash160bit, pubKeyHash);

    return bscript.compile([
        OPS.OP_DUP,
        OPS.OP_HASH160,
        pubKeyHash,
        OPS.OP_EQUALVERIFY,
        OPS.OP_CHECKSIG
    ]);
}

function decode(buffer) {
    typeforce(check, buffer);

    return buffer.slice(3, 23);
}

module.exports = {
    check: check,
    decode: decode,
    encode: encode
};
