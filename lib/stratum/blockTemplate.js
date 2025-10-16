const merkle = require('./merkleTree.js');
const transactions = require('./transactions.js');
const util = require('./util.js');
const logging = require('../modules/logging.js');

/**
 * The BlockTemplate class holds a single job.
 * and provides several methods to validate and submit it to the daemon coin
**/
const BlockTemplate = module.exports = function BlockTemplate(jobId, rpcData, extraNoncePlaceholder, reward, recipients, poolAddress, coin, pubkey) {
    const config = JSON.parse(process.env.config);
    const coinName = config.coin.name;
    //private members
    const submits = new Set();
    //public members
    this.rpcData = rpcData;
    this.jobId = jobId;

    // get target info
    this.target = BigInt('0x' + rpcData.target);

    // generate the fees and coinbase tx
    const blockReward = (this.rpcData.miner) * 100000000;

    const fees = [];
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
    // Precompute reversed bits once
    const reversedBitsHex = util.reverseBuffer(Buffer.from(rpcData.bits, 'hex')).toString('hex');
    this.serializeHeader = function (nTime, nonce) {
        // 140 bytes header pre-allocated (without solution)
        const header = Buffer.alloc(140);
        let position = 0;
        header.writeUInt32LE(this.rpcData.version, position, 4, 'hex'); position += 4;
        header.write(this.prevHashReversed, position, 32, 'hex'); position += 32;
        header.write(this.merkleRootReversed, position, 32, 'hex'); position += 32;
        header.write(this.hashReserved, position, 32, 'hex'); position += 32;
        header.write(nTime, position, 4, 'hex'); position += 4;
        header.write(reversedBitsHex, position, 4, 'hex'); position += 4;
        header.write(nonce, position, 32, 'hex');
        return header;
    };

    // join the header and txs together
    this.serializeBlock = function (header, soln) {
        // Prebuild varInt for tx count (supporting only common small cases currently)
        const txCount = this.txCount;
        let varInt;
        if (txCount < 0xfd) {
            varInt = Buffer.from([txCount]);
        } else if (txCount <= 0xffff) {
            varInt = Buffer.alloc(3);
            varInt[0] = 0xfd;
            varInt.writeUInt16LE(txCount, 1);
        } else {
            // Fallback to existing generic approach for larger counts (rare in coinbase context)
            const hex = txCount.toString(16).padStart(Math.ceil(txCount.toString(16).length / 2) * 2, '0');
            varInt = Buffer.concat([Buffer.from('FD', 'hex'), util.reverseBuffer(Buffer.from(hex, 'hex'))]);
        }
        const txBuffersLen = this.rpcData.transactions.length;
        const buffers = new Array(3 + txBuffersLen);
        buffers[0] = header;
        buffers[1] = soln;
        buffers[2] = varInt;
        const genTxBuffer = Buffer.from(this.genTx, 'hex');
        buffers.push(genTxBuffer);
        if (txBuffersLen > 0) {
            for (let i = 0; i < txBuffersLen; i++) {
                buffers.push(Buffer.from(this.rpcData.transactions[i].data, 'hex'));
            }
        }
        return Buffer.concat(buffers);
    };

    // register a submission; include extranonce1, extranonce2, nTime, nonce to avoid duplicates more robustly
    this.registerSubmit = function (extraNonce1, extraNonce2, nTime, nonce) {
        // Composite key; all parts already hex strings
        const submission = (extraNonce1 + ':' + extraNonce2 + ':' + nTime + ':' + nonce).toLowerCase();
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

    // Calculate difficulty using BigInt arithmetic to avoid overflow
    const diff1BigInt = BigInt(algos.komodo.diff1);
    const difficultyBigInt = diff1BigInt / this.target;
    this.difficulty = parseFloat(Number(difficultyBigInt).toFixed(9));

    // Calculate base nethash value once
    const baseNethash = (this.difficulty * Math.pow(2, 32)) / 60;

    // Pre-compute formatted values for each unit
    const msolValue = (baseNethash / Math.pow(10, 15)).toFixed(2);
    const ksolValue = (baseNethash / Math.pow(10, 12)).toFixed(2);
    const solValue = (baseNethash / Math.pow(10, 9)).toFixed(2);

    let nethash, unit;
    if (msolValue > 1) {
        nethash = msolValue;
        unit = 'Msol/s';
    } else if (ksolValue > 1) {
        nethash = ksolValue;
        unit = 'ksol/s';
    } else if (solValue > 1) {
        nethash = solValue;
        unit = 'sol/s';
    }

    if (nethash && (!process.env.forkId || process.env.forkId === '0')) {
        logging('Blocks', 'warning', 'Effective nethash is: ' + nethash + ' ' + unit);
    }
    if (!process.env.forkId || process.env.forkId === '0') {
        logging('Blocks', 'warning', rpcData.height + ' block diff is: ' + this.difficulty);
    }

};
