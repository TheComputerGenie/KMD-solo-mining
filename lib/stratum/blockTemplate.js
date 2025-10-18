// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const merkle = require('./merkleTree.js');
// Coinbase/transaction creation delegated to algorithm implementation now
const util = require('./util.js');
const logging = require('../modules/logging.js');

/**
 * The BlockTemplate class holds a single job.
 * and provides several methods to validate and submit it to the daemon coin
**/
// BlockTemplate now accepts an algo interface instance for algorithm-specific calculations
const BlockTemplate = module.exports = function BlockTemplate(jobId, rpcData, extraNoncePlaceholder, reward, recipients, poolAddress, coin, pubkey, algo) {
    const config = JSON.parse(process.env.config);
    const coinName = config.coin.name;
    //private members
    const submits = new Set();
    //public members
    this.rpcData = rpcData;
    this.jobId = jobId;

    // get target info
    this.target = BigInt(`0x${rpcData.target}`);

    // generate the fees and coinbase tx
    const blockReward = (this.rpcData.miner) * 100000000;

    const fees = [];
    rpcData.transactions.forEach((value) => {
        fees.push(value);
    });
    // Calculate total fees via algorithm abstraction
    this.rewardFees = algo.calculateFees(fees);
    rpcData.rewardFees = this.rewardFees;

    if (typeof this.genTx === 'undefined') {
        const gen = algo.createGeneration({
            height: rpcData.height,
            blockReward: blockReward,
            feeReward: this.rewardFees,
            recipients: recipients,
            poolAddress: poolAddress,
            coin: coin,
            pubkey: pubkey,
            vouts: this.rpcData.vouts
        });
        this.genTx = gen.hex;
        this.genTxHash = gen.hash;
    }

    // generate the merkle root
    this.prevHashReversed = util.reverseBuffer(Buffer.from(rpcData.previousblockhash, 'hex')).toString('hex');
    this.hashReserved = util.reverseBuffer(Buffer.from(rpcData.finalsaplingroothash, 'hex')).toString('hex');
    this.merkleRoot = merkle.getRoot(rpcData, this.genTxHash);
    this.txCount = this.rpcData.transactions.length + 1; // add total txs and new coinbase
    this.merkleRootReversed = util.reverseBuffer(Buffer.from(this.merkleRoot, 'hex')).toString('hex');
    // we can't do anything else until we have a submission

    // Precompute reversed bits once
    const reversedBitsHex = util.reverseBuffer(Buffer.from(rpcData.bits, 'hex')).toString('hex');
    this.serializeHeader = function (nTime, nonce) {
        return algo.serializeHeader({
            version: this.rpcData.version,
            prevHashReversed: this.prevHashReversed,
            merkleRootReversed: this.merkleRootReversed,
            hashReserved: this.hashReserved,
            nTime: nTime,
            reversedBitsHex: reversedBitsHex,
            nonce: nonce
        });
    };

    // join the header and txs together
    this.serializeBlock = function (header, soln) {
        return algo.serializeBlock({
            header: header,
            soln: soln,
            txCount: this.txCount,
            transactions: this.rpcData.transactions,
            genTx: this.genTx
        });
    };

    // register a submission; include extranonce1, extranonce2, nTime, nonce to avoid duplicates more robustly
    this.registerSubmit = function (extraNonce1, extraNonce2, nTime, nonce) {
        // Composite key; all parts already hex strings
        const submission = (`${extraNonce1}:${extraNonce2}:${nTime}:${nonce}`).toLowerCase();
        if (!submits.has(submission)) {
            submits.add(submission);
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

    // Require algorithm instance supplied by caller; remain agnostic
    if (!algo) {
        throw new Error('Algorithm instance not provided to BlockTemplate');
    }
    this.difficulty = algo.calculateDifficulty(rpcData.target);

    if (!process.env.forkId || process.env.forkId === '0') {
        logging('Blocks', 'warning', `${rpcData.height} block diff is: ${this.difficulty}`);
    }

};
