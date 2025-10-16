const bitcoin = require('../utxo_lib');
const util = require('./util.js');
const logging = require('../modules/logging.js');
const init = require('../../init');
// public members
let txHash;

exports.txHash = function () {
    return txHash;
};

const scriptCompile = addrHash =>
    bitcoin.script.compile([
        bitcoin.opcodes.OP_DUP,         //76
        bitcoin.opcodes.OP_HASH160,     //A9
        addrHash,
        bitcoin.opcodes.OP_EQUALVERIFY, //88
        bitcoin.opcodes.OP_CHECKSIG     //AC
    ]);

const scriptCompileP2PK = pubkey =>
    bitcoin.script.compile([
        Buffer.from(pubkey, 'hex'),
        bitcoin.opcodes.OP_CHECKSIG     //AC
    ]);
//   = transactions.createGeneration(rpcData.height, blockReward, this.rewardFees, recipients, poolAddress, coin, pubkey, this.rpcData.vouts).toString('hex');
exports.createGeneration = function (blockHeight, blockReward, feeReward, recipients, poolAddress, coin, pubkey, vouts) {
    const poolAddrHash = bitcoin.address.fromBase58Check(poolAddress).hash;
    const NotaryDaemon = JSON.stringify(init.cconfig.amNotary);
    //console.log('cconfig: ', NotaryDaemon)
    //console.log('vouts: ' + JSON.stringify(vouts));
    const network = bitcoin.networks[coin.symbol];
    //console.log('network: ', network)
    const txb = new bitcoin.TransactionBuilder(network);
    txb.setVersion(bitcoin.Transaction.ZCASH_SAPLING_VERSION);

    // input for coinbase tx
    let blockHeightSerial;
    if (blockHeight.toString(16).length % 2 === 0) {
        blockHeightSerial = blockHeight.toString(16);
    } else {
        blockHeightSerial = `0${  blockHeight.toString(16)}`;
    }

    const height = Math.ceil((blockHeight << 1).toString(2).length / 8);
    const lengthDiff = blockHeightSerial.length / 2 - height;
    for (let i = 0; i < lengthDiff; i++) {
        blockHeightSerial = `${blockHeightSerial  }00`;
    }
    length = `0${  height}`;

    const serializedBlockHeight = Buffer.concat([
        Buffer.from(length, 'hex'),
        util.reverseBuffer(Buffer.from(blockHeightSerial, 'hex')),
        Buffer.from('00', 'hex') // OP_0
    ]);

    txb.addInput(
        Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
        4294967295,
        4294967295,
        Buffer.concat([serializedBlockHeight, Buffer.from(Buffer.from(blockHeight.toString(), 'utf8').toString('hex'), 'hex')])
    );

    let i;
    for (i = 0; i <= vouts.length - 1; i++) {
        const amt = parseInt(vouts[i].valueZat, 10);
        if (i == 0) {
            if (coin.symbol.toUpperCase() === 'KMD') {
                if (!process.env.forkId || process.env.forkId === '0') {
                    logging('Blocks', amt > 1 * Math.pow(10, 9) ? 'error' : 'debug', `${blockHeight  } would pay: ${  amt / Math.pow(10, 8)}`);
                }
            } else {
                if (!process.env.forkId || process.env.forkId === '0') {
                    logging('Blocks', 'debug', `${blockHeight  } would pay: ${  amt / Math.pow(10, 8)}`);
                }
            }
        }

        //console.log(vouts[i].scriptPubKey.type)
        //console.log(vouts[i].scriptPubKey.addresses[0])
        switch (vouts[i].scriptPubKey.type) {
        case 'pubkey':
            if (typeof NotaryDaemon !== 'undefined') {
                if (NotaryDaemon === 'true') {
                    txb.addOutput(scriptCompile(poolAddrHash), amt);
                } else {
                    //console.log(NotaryDaemon)
                    txb.addOutput(scriptCompileP2PK(i == 0 ? pubkey : vouts[i].scriptPubKey.asm.split(' ', 1)), amt);
                }
                break;
            } else {
                txb.addOutput(scriptCompileP2PK(i == 0 ? pubkey : vouts[i].scriptPubKey.asm.split(' ', 1)), amt);
            }
            break;
        case 'nulldata':
            txb.addOutput(Buffer.from(vouts[i].scriptPubKey.hex, 'hex'), amt);
            break;
        case 'pubkeyhash':
            txb.addOutput(scriptCompile(i == 0 ? poolAddrHash : bitcoin.address.fromBase58Check(vouts[i].scriptPubKey.addresses[0]).hash), amt);
            break;
        default:
            logging('Blocks', 'debug', JSON.stringify(vouts[i]));
            txb.addOutput(scriptCompile(i == 0 ? poolAddrHash : bitcoin.address.fromBase58Check(vouts[i].scriptPubKey.addresses[0]).hash), amt);
            break;
        }
    }
    const tx = txb.build();
    txHex = tx.toHex();

    // assign
    txHash = tx.getHash().toString('hex');

    return txHex;
};

module.exports.getFees = function (feeArray) {
    let fee = 0;
    for (let i = 0; i < feeArray.length; i++) {
        fee += +feeArray[i].fee; // unary + to coerce once
    }
    return fee;
};
