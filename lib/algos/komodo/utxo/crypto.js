// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const crypto = require('crypto');

function createHash(algorithm) {
    return (buffer) => crypto.createHash(algorithm).update(buffer).digest();
}

const ripemd160 = createHash('ripemd160');
const sha1 = createHash('sha1');
const sha256 = createHash('sha256');

function hash160(buffer) {
    return ripemd160(sha256(buffer));
}

function hash256(buffer) {
    return sha256(sha256(buffer));
}

module.exports = {
    hash160,
    hash256,
    ripemd160,
    sha1,
    sha256
};