const util = require('./util.js');
const merkle = require('../merkle.js');

function calcRoot(hashes) {
    const result = merkle(hashes);
    return result.root;
}

// Build merkle root input list with pre-allocation to avoid dynamic array growth
exports.getRoot = function (rpcData, generateTxRaw) {
    const txs = rpcData.transactions;
    const txCount = txs.length;
    if (txCount === 0) {
        return util.reverseBuffer(Buffer.from(generateTxRaw, 'hex')).toString('hex');
    }
    // +1 for coinbase / generation transaction
    const hashes = new Array(txCount + 1);
    hashes[0] = util.reverseBuffer(Buffer.from(generateTxRaw, 'hex')).toString('hex');
    for (let i = 0; i < txCount; i++) {
        hashes[i + 1] = txs[i].hash;
    }
    return calcRoot(hashes);
};
