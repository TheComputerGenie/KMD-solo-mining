var bignum = require('bignum');

var merkle = require('./merkleTree.js');
var transactions = require('./transactions.js');
var util = require('./util.js');
const logging = require('../modules/logging.js');

/**
 * The BlockTemplate class holds a single job.
 * and provides several methods to validate and submit it to the daemon coin
**/
var BlockTemplate = module.exports = function BlockTemplate(jobId, rpcData, extraNoncePlaceholder, reward, recipients, poolAddress, coin, pubkey) {
    var config = JSON.parse(process.env.config);
    var coin = config.coin.name;
    //private members
    var submits = [];
    //public members
    this.rpcData = rpcData;
    this.jobId = jobId;

    // get target info
    this.target = bignum(rpcData.target, 16);

    // generate the fees and coinbase tx
    var blockReward = (this.rpcData.miner) * 100000000;

    var fees = [];
    rpcData.transactions.forEach(function (value) {
        fees.push(value);
    });
    this.rewardFees = transactions.getFees(fees);
    rpcData.rewardFees = this.rewardFees;

    if (typeof this.genTx === 'undefined') {
        this.genTx = transactions.createGeneration(rpcData.height, blockReward, this.rewardFees, recipients, poolAddress, coin, pubkey, this.rpcData.vouts).toString('hex');
        this.genTxHash = transactions.txHash();
    }

    // generate the merkle root
    this.prevHashReversed = util.reverseBuffer(Buffer.from(rpcData.previousblockhash, 'hex')).toString('hex');
    this.hashReserved = util.reverseBuffer(Buffer.from(rpcData.finalsaplingroothash, 'hex')).toString('hex');
    this.merkleRoot = merkle.getRoot(rpcData, this.genTxHash);
    this.txCount = this.rpcData.transactions.length + 1; // add total txs and new coinbase
    this.merkleRootReversed = util.reverseBuffer(Buffer.from(this.merkleRoot, 'hex')).toString('hex');
    // we can't do anything else until we have a submission

    //block header per https://github.com/zcash/zips/blob/master/protocol/protocol.pdf
    this.serializeHeader = function (nTime, nonce) {
        var header = Buffer.alloc(140);
        var position = 0;

        header.writeUInt32LE(this.rpcData.version, position += 0, 4, 'hex');
        header.write(this.prevHashReversed, position += 4, 32, 'hex');
        header.write(this.merkleRootReversed, position += 32, 32, 'hex');
        header.write(this.hashReserved, position += 32, 32, 'hex');
        header.write(nTime, position += 32, 4, 'hex');
        header.write(util.reverseBuffer(Buffer.from(rpcData.bits, 'hex')).toString('hex'), position += 4, 4, 'hex');
        header.write(nonce, position += 4, 32, 'hex');
        return header;
    };

    // join the header and txs together
    this.serializeBlock = function (header, soln) {

        var txCount = this.txCount.toString(16);
        if (Math.abs(txCount.length % 2) == 1) {
            txCount = "0" + txCount;
        }

        /* https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer */
        if (this.txCount < 0xfd) {
            var varInt = Buffer.from(txCount, 'hex');
        } else if (this.txCount <= 0x7fff) {
            if (txCount.length == 2) {
                txCount = "00" + txCount;
            }
            var varInt = Buffer.concat([Buffer.from('FD', 'hex'), util.reverseBuffer(Buffer.from(txCount, 'hex'))]);
        }

        buf = Buffer.concat([
            header,
            soln,
            varInt,
            Buffer.from(this.genTx, 'hex')
        ]);

        if (this.rpcData.transactions.length > 0) {
            this.rpcData.transactions.forEach(function (value) {
                tmpBuf = Buffer.concat([buf, Buffer.from(value.data, 'hex')]);
                buf = tmpBuf;
            });
        }

        return buf;
    };

    // submit the block header
    this.registerSubmit = function (header, soln) {
        var submission = (header + soln).toLowerCase();
        if (submits.indexOf(submission) === -1) {

            submits.push(submission);
            return true;
        }
        return false;
    };

    // used for mining.notify
    this.getJobParams = function () {
        if (!this.jobParams) {
            this.jobParams = [
                this.jobId,
                util.packUInt32LE(this.rpcData.version).toString('hex'),
                this.prevHashReversed,
                this.merkleRootReversed,
                this.hashReserved,
                util.packUInt32LE(rpcData.curtime).toString('hex'),
                util.reverseBuffer(Buffer.from(this.rpcData.bits, 'hex')).toString('hex'),
                true
            ];
        }
        return this.jobParams;
    };

    this.difficulty = parseFloat((algos.komodo.diff1 / this.target.toNumber()).toFixed(9));
    //silly to use case here, but...
    switch (true) {
        case (((((this.difficulty * Math.pow(2, 32)) / 60) / Math.pow(10, 15)).toFixed(2)) > 1):
            var nethash = ((((this.difficulty * Math.pow(2, 32)) / 60) / Math.pow(10, 15)).toFixed(2));
            if (!process.env.forkId || process.env.forkId === '0') { logging('Blocks', 'warning', 'Effective nethash is: ' + nethash + ' Msol/s') }
            break;
        case (((((this.difficulty * Math.pow(2, 32)) / 60) / Math.pow(10, 12)).toFixed(2)) > 1):
            var nethash = ((((this.difficulty * Math.pow(2, 32)) / 60) / Math.pow(10, 12)).toFixed(2));
            if (!process.env.forkId || process.env.forkId === '0') { logging('Blocks', 'warning', 'Effective nethash is: ' + nethash + ' ksol/s') }
            break;
        case (((((this.difficulty * Math.pow(2, 32)) / 60) / Math.pow(10, 9)).toFixed(2)) > 1):
            var nethash = ((((this.difficulty * Math.pow(2, 32)) / 60) / Math.pow(10, 9)).toFixed(2));
            if (!process.env.forkId || process.env.forkId === '0') { logging('Blocks', 'warning', 'Effective nethash is: ' + nethash + ' sol/s') }
            break;
    }
    this.difficulty = parseFloat((algos.komodo.diff1 / this.target.toNumber()).toFixed(9));
    if (!process.env.forkId || process.env.forkId === '0') { logging('Blocks', 'warning', rpcData.height + ' block diff is: ' + this.difficulty) }

};
