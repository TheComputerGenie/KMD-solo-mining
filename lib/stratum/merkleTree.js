const util = require('./util.js');
const nodeUtil = require('util');
var merklebitcoin = nodeUtil.promisify(require('merkle-bitcoin'));

function calcRoot(hashes) {
    var result = merklebitcoin(hashes);
    return Object.values(result)[2].root;
}

exports.getRoot = function (rpcData, generateTxRaw) {
    hashes = [util.reverseBuffer(new Buffer(generateTxRaw, 'hex')).toString('hex')];
    rpcData.transactions.forEach(function (value) { hashes.push(value.hash); });
    if (hashes.length === 1) { return hashes[0]; }
    var result = calcRoot(hashes);
    return result;
};
