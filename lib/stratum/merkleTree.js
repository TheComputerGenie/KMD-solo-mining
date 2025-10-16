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
