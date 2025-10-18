// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const decompile = require('../script').decompile;
const pubKey = require('./pubkey');
const pubKeyHash = require('./pubkeyhash');
const scriptHash = require('./scripthash');

const types = {
    NONSTANDARD: 'nonstandard',
    P2PK: 'pubkey',
    P2PKH: 'pubkeyhash',
    P2SH: 'scripthash'
};

function classifyOutput(script) {
    if (pubKeyHash.output.check(script)) {
        return types.P2PKH;
    }
    if (scriptHash.output.check(script)) {
        return types.P2SH;
    }

    // XXX: optimization, below functions .decompile before use
    const chunks = decompile(script);
    if (pubKey.output.check(chunks)) {
        return types.P2PK;
    }

    return types.NONSTANDARD;
}

function classifyInput(script, allowIncomplete) {
    // XXX: optimization, below functions .decompile before use
    const chunks = decompile(script);

    if (pubKeyHash.input.check(chunks)) {
        return types.P2PKH;
    }
    if (scriptHash.input.check(chunks, allowIncomplete)) {
        return types.P2SH;
    }
    if (pubKey.input.check(chunks)) {
        return types.P2PK;
    }

    return types.NONSTANDARD;
}

function classifyWitness(script, allowIncomplete) {
    // XXX: optimization, below functions .decompile before use
    const chunks = decompile(script);

    return types.NONSTANDARD;
}

module.exports = {
    classifyInput: classifyInput,
    classifyOutput: classifyOutput,
    classifyWitness: classifyWitness,
    pubKey: pubKey,
    pubKeyHash: pubKeyHash,
    scriptHash: scriptHash,
    types: types
};