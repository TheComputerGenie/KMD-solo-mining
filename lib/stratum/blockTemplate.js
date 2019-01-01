const bignum = require('bignum');
const util = require('./util.js');
const merkle = require('./merkleTree.js');
const transactions = require('./transactions.js');

var BlockTemplate = module.exports = function BlockTemplate(jobId, rpcData, poolAddress) {
    var submits = [];
    this.rpcData = rpcData;
    this.jobId = jobId;
    this.target = bignum(rpcData.target, 16);
    this.difficulty = parseFloat((diff1 / this.target.toNumber()).toFixed(9));
    var blockReward = (this.rpcData.miner) * 100000000;
    var fees = [];
    rpcData.transactions.forEach(function (value) { fees.push(value); });
    this.rewardFees = transactions.getFees(fees);
    rpcData.rewardFees = this.rewardFees;
    this.generationTransaction = transactions.createGeneration(rpcData.height, blockReward, this.rewardFees, poolAddress).toString('hex');
    this.genTxHash = transactions.txHash();
    this.prevHashReversed = util.reverseBuffer(new Buffer(rpcData.previousblockhash, 'hex')).toString('hex');
    this.finalSaplingRootHashReversed = util.reverseBuffer(new Buffer(rpcData.finalsaplingroothash, 'hex')).toString('hex');
    this.merkleRoot = merkle.getRoot(rpcData, this.genTxHash);
    this.txCount = this.rpcData.transactions.length + 1; // add total txs and new coinbase
    this.merkleRootReversed = util.reverseBuffer(new Buffer(this.merkleRoot, 'hex')).toString('hex');
    this.serializeHeader = function (nTime, nonce) {
        var header = new Buffer(140);
        var position = 0;
        header.writeUInt32LE(this.rpcData.version, position += 0, 4, 'hex');
        header.write(this.prevHashReversed, position += 4, 32, 'hex');
        header.write(this.merkleRootReversed, position += 32, 32, 'hex');
        header.write(this.finalSaplingRootHashReversed, position += 32, 32, 'hex');
        header.write(nTime, position += 32, 4, 'hex');
        header.write(util.reverseBuffer(new Buffer(rpcData.bits, 'hex')).toString('hex'), position += 4, 4, 'hex');
        header.write(nonce, position += 4, 32, 'hex');
        return header;
    };
    this.serializeBlock = function (header, soln) {
        var txCount = this.txCount.toString(16);
        if (Math.abs(txCount.length % 2) == 1) { txCount = "0" + txCount; }
        if (this.txCount <= 0x7f) {
            var varInt = new Buffer(txCount, 'hex');
        } else if (this.txCount <= 0x7fff) {
            if (txCount.length == 2) txCount = "00" + txCount;
            var varInt = new Buffer.concat([Buffer('FD', 'hex'), util.reverseBuffer(new Buffer(txCount, 'hex'))]);
        }
        buf = new Buffer.concat([header, soln, varInt, new Buffer(this.generationTransaction, 'hex')]);
        if (this.rpcData.transactions.length > 0) {
            this.rpcData.transactions.forEach(function (value) {
                tmpBuf = new Buffer.concat([buf, new Buffer(value.data, 'hex')]);
                buf = tmpBuf;
            });
        }
        return buf;
    };
    this.registerSubmit = function (header, soln) {
        var submission = (header + soln).toLowerCase();
        if (submits.indexOf(submission) === -1) {
            submits.push(submission);
            return true;
        }
        return false;
    };
    this.getJobParams = function () {
        if (!this.jobParams) {
            this.jobParams = [
                this.jobId, util.packUInt32LE(this.rpcData.version).toString('hex'),
                this.prevHashReversed, this.merkleRootReversed, this.finalSaplingRootHashReversed,
                util.packUInt32LE(rpcData.curtime).toString('hex'),
                util.reverseBuffer(new Buffer(this.rpcData.bits, 'hex')).toString('hex'), true
            ];
        }
        return this.jobParams;
    };
};
