// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// OP_HASH160 {scriptHash} OP_EQUAL

const bscript = require('../../script');
const types = require('../../types');
const typeforce = require('../../typeforce');
const OPS = require('../../opcodes');

function check(script) {
    const buffer = bscript.compile(script);

    return buffer.length === 23 &&
        buffer[0] === OPS.OP_HASH160 &&
        buffer[1] === 0x14 &&
        buffer[22] === OPS.OP_EQUAL;
}
check.toJSON = function () {
    return 'scriptHash output';
};

function encode(scriptHash) {
    typeforce(types.Hash160bit, scriptHash);

    return bscript.compile([OPS.OP_HASH160, scriptHash, OPS.OP_EQUAL]);
}

function decode(buffer) {
    typeforce(check, buffer);

    return buffer.slice(2, 22);
}

module.exports = {
    check: check,
    decode: decode,
    encode: encode
};
