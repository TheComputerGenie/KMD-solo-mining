// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// https://en.bitcoin.it/wiki/List_of_address_prefixes
// Dogecoin BIP32 is a proposed standard: https://bitcointalk.org/index.php?topic=409731
const coins = require('./coins');

module.exports = {
    default: {
        messagePrefix: '\x18Default Signed Message:\n',
        bip32: {
            public: 0x0488b21e,
            private: 0x0488ade4
        },
        pubKeyHash: 0x3c,
        scriptHash: 0x55,
        wif: 0xBC,
        consensusBranchId: {
            1: 0x00,
            2: 0x00,
            3: 0x5ba81b19,
            4: 0x76b809bb
        },
        coin: coins.DEFAULT,
        isZcash: true
    },
    kmd: {
        messagePrefix: '\x18Komodo Signed Message:\n',
        bip32: {
            public: 0x0488b21e,
            private: 0x0488ade4
        },
        pubKeyHash: 0x3c,
        scriptHash: 0x55,
        wif: 0xBC,
        consensusBranchId: {
            1: 0x00,
            2: 0x00,
            3: 0x5ba81b19,
            4: 0x76b809bb
        },
        coin: coins.KMD,
        isZcash: true
    },
    KMD: {
        messagePrefix: '\x18Komodo Signed Message:\n',
        bip32: {
            public: 0x0488b21e,
            private: 0x0488ade4
        },
        pubKeyHash: 0x3c,
        scriptHash: 0x55,
        wif: 0xBC,
        consensusBranchId: {
            1: 0x00,
            2: 0x00,
            3: 0x5ba81b19,
            4: 0x76b809bb
        },
        coin: coins.KMD,
        isZcash: true
    }
};