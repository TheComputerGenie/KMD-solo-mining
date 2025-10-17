// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const script = require('./script');

const templates = require('./templates');
for (const key in templates) {
    script[key] = templates[key];
}

module.exports = {
    bufferutils: require('./bufferutils'),

    Transaction: require('./transaction'),
    TransactionBuilder: require('./transaction_builder'),

    address: require('./address'),
    coins: require('./coins'),
    crypto: require('./crypto'),
    networks: require('./networks'),
    opcodes: require('./opcodes'),
    script: script
};
