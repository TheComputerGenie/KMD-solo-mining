// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const util = require('./util.js');
const merkle = require('../merkle.js');

exports.getRoot = function (rpcData, generateTxRaw) {
    const txs = rpcData.transactions;
    const txCount = txs.length;

    if (txCount === 0) {
        return util.reverseBuffer(Buffer.from(generateTxRaw, 'hex')).toString('hex');
    }

    const hashes = new Array(txCount + 1);
    hashes[0] = util.reverseBuffer(Buffer.from(generateTxRaw, 'hex')).toString('hex');

    for (let i = 0; i < txCount; i++) {
        hashes[i + 1] = txs[i].hash;
    }

    const result = merkle(hashes);
    return result.root;
};
