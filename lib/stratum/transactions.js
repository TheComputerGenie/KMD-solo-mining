const bitcoin = require("bitgo-utxo-lib");
var util = require("./util.js");
var bignum = require("bignum");
const logging = require("../modules/logging.js");
const init = require("../../init");
// public members
var txHash;

exports.txHash = function() {
    return txHash;
};
//TODO(alstr): Add founders and remove notary from transactions
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
                                      Buffer.from(pubkey, "hex"),
                                      bitcoin.opcodes.OP_CHECKSIG     //AC
                                  ]);
function toHexy(str) {
    var arr1 = [];
    for (var n = 0, l = str.length; n < l; n++) {
        var hex = Number(str.charCodeAt(n)).toString(16);
        arr1.push(hex);
    }
    return arr1.join("");
}
//   = transactions.createGeneration(rpcData.height, blockReward, this.rewardFees, recipients, poolAddress, coin, pubkey, this.rpcData.vouts).toString('hex');
exports.createGeneration = function( blockHeight, blockReward, feeReward, recipients, poolAddress, coin, pubkey, vouts) {
    var poolAddrHash = bitcoin.address.fromBase58Check(poolAddress).hash;
    var NotaryDaemon = JSON.stringify(init.cconfig.amNotary);
    //console.log('cconfig: ', NotaryDaemon)
    //console.log('vouts: ' + JSON.stringify(vouts));
    let network = bitcoin.networks[coin.symbol];
    //console.log('network: ', network)
    let txb = new bitcoin.TransactionBuilder(network);
    txb.setVersion(bitcoin.Transaction.ZCASH_SAPLING_VERSION);

    // input for coinbase tx
    if (blockHeight.toString(16).length % 2 === 0) {
        var blockHeightSerial = blockHeight.toString(16);
    } else {
        var blockHeightSerial = "0" + blockHeight.toString(16);
    }

    var height = Math.ceil((blockHeight << 1).toString(2).length / 8);
    var lengthDiff = blockHeightSerial.length / 2 - height;
    for (var i = 0; i < lengthDiff; i++) {
        blockHeightSerial = blockHeightSerial + "00";
    }
    length = "0" + height;

    var serializedBlockHeight = new Buffer.concat([
                new Buffer(length, "hex"),
                util.reverseBuffer(new Buffer(blockHeightSerial, "hex")),
                new Buffer("00", "hex") // OP_0
            ]);

    txb.addInput(
        new Buffer("0000000000000000000000000000000000000000000000000000000000000000", "hex"),
        4294967295,
        4294967295,
        new Buffer.concat([serializedBlockHeight, Buffer(toHexy(blockHeight.toString()), "hex")])
    );

    var i;
    for (i = 0; i <= vouts.length - 1; i++) {
        let amt = parseInt(vouts[i].valueZat, 10);
        if (i == 0) {
            if (coin.toUpperCase() === "KMD") {
                if (!process.env.forkId || process.env.forkId === "0") {
                    logging("Blocks",  amt > 1 * Math.pow(10, 9) ? "error" : "debug", blockHeight + " would pay: " + amt / Math.pow(10, 8));
                }
            } else {
                if (!process.env.forkId || process.env.forkId === "0") {
                    logging("Blocks", "debug", blockHeight + " would pay: " + amt / Math.pow(10, 8));
                }
            }
        }

//console.log(vouts[i].scriptPubKey.type)
//console.log(vouts[i].scriptPubKey.addresses[0])
        switch (vouts[i].scriptPubKey.type) {
        case "pubkey":
            if (typeof NotaryDaemon !== "undefined") {
                if (NotaryDaemon === "true") {
                    txb.addOutput(scriptCompile(poolAddrHash), amt);
                } else {
//console.log(NotaryDaemon)
                    txb.addOutput(scriptCompileP2PK(i == 0 ? pubkey : vouts[i].scriptPubKey.asm.split(" ", 1)), amt);
                }
                break;
            } else {
                txb.addOutput(scriptCompileP2PK(i == 0 ? pubkey : vouts[i].scriptPubKey.asm.split(" ", 1)), amt);
            }
            break;
        case "pubkeyhash":
            txb.addOutput(scriptCompile( i == 0 ? poolAddrHash : bitcoin.address.fromBase58Check(vouts[i].scriptPubKey.addresses[0]).hash), amt);
            break;
        default:
            //logging("Blocks", "debug", JSON.stringify(vouts[i]))
            txb.addOutput(scriptCompile(i == 0 ? poolAddrHash : bitcoin.address.fromBase58Check(vouts[i].scriptPubKey.addresses[0]).hash), amt);
            break;
        }
    }
    let tx = txb.build();
    txHex = tx.toHex();

    // assign
    txHash = tx.getHash().toString("hex");

    return txHex;
};

module.exports.getFees = function(feeArray) {
    var fee = Number();
    feeArray.forEach(function(value) { fee = fee + Number(value.fee); });
    return fee;
};
