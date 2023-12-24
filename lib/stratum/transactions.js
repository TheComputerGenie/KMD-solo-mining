const util = require('./util.js');
const init = require('../../init')
const bitcoin = require('bitgo-utxo-lib');
const logging = require('../modules/logging.js');
// public members
var txHash;
exports.txHash = function () { return txHash; };
function scriptCompile(addrHash) {
    script = bitcoin.script.compile([bitcoin.opcodes.OP_DUP, bitcoin.opcodes.OP_HASH160, addrHash, bitcoin.opcodes.OP_EQUALVERIFY, bitcoin.opcodes.OP_CHECKSIG]);
    return script;
}
/**
 * @todo Increase versatility
 * @body Adding P2PK is needed to make this work across more chains.
 */
exports.createGeneration = function (blockHeight, blockReward, feeReward, poolAddress) {
    let KMDcoin = init.cconfig.symbol.toLowerCase();
    var poolAddrHash = bitcoin.address.fromBase58Check(poolAddress).hash;
    let network = bitcoin.networks[KMDcoin]
    let tx = new bitcoin.TransactionBuilder(network)
    tx.setVersion(bitcoin.Transaction.ZCASH_SAPLING_VERSION);
    let blockHeightSerial = (blockHeight.toString(16).length % 2 === 0 ? '' : '0') + blockHeight.toString(16)
    let height = Math.ceil((blockHeight << 1).toString(2).length / 8)
    var lengthDiff = blockHeightSerial.length / 2 - height;
    for (let i = 0; i < lengthDiff; i++) { blockHeightSerial = `${blockHeightSerial}00` }
    let length = `0${height}`
    let serializedBlockHeight = new Buffer.concat([
        new Buffer(length, 'hex'), util.reverseBuffer(new Buffer(blockHeightSerial, 'hex')), new Buffer('00', 'hex') // OP_0
    ]);
    tx.addInput(new Buffer('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        4294967295, 4294967295,
        new Buffer.concat([serializedBlockHeight,
            Buffer('4b4d4420736f6c6f2d6d696e696e672068747470733a2f2f6769746875622e636f6d2f546865436f6d707574657247656e69652f4b4d442d736f6c6f2d6d696e696e67', 'hex')])
        //KMD solo-mining https://github.com/TheComputerGenie/KMD-solo-mining
    );
    var fullreward = blockReward + feeReward;
    logging('Blocks', (fullreward > (1 * Math.pow(10, 9)) ? 'error' : 'debug'), 'Current block would pay: ' + (fullreward/ Math.pow(10, 8)))
    tx.addOutput(scriptCompile(poolAddrHash), fullreward);
    let txb = tx.build()
    txHex = txb.toHex()
    txHash = txb.getHash().toString('hex');
    return txHex;
};
module.exports.getFees = function (feeArray) {
    var fee = Number();
    feeArray.forEach(function (value) {
        fee = fee + Number(value.fee);
    });
    return fee;
};
