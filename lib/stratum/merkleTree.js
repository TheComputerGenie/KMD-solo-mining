const util = require('./util.js');
var merkle = require('../merkle.js');

function calcRoot(hashes) {
    var result = merkle(hashes);
    return result.root;
}

exports.getRoot = function (rpcData, generateTxRaw) {
    hashes = [util.reverseBuffer(Buffer.from(generateTxRaw, 'hex')).toString('hex')];
    rpcData.transactions.forEach(function (value) { hashes.push(value.hash); });
    if (hashes.length === 1) { return hashes[0]; }
    var result = calcRoot(hashes);
    return result;
};
