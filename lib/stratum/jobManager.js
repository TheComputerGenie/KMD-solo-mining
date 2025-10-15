const events = require('events');
const crypto = require('crypto');
const util = require('./util.js');
const blockTemplate = require('./blockTemplate.js');

//Unique extranonce per subscriber
var ExtraNonceCounter = function (configInstanceId) {
    var instanceId = configInstanceId || crypto.randomBytes(4).readUInt32LE(0);
    var counter = instanceId << 27;
    this.next = function () {
        var extraNonce = util.packUInt32BE(Math.abs(counter++));
        return extraNonce.toString('hex');
    };
    this.size = 4; //bytes
};

//Unique job per new block template
var JobCounter = function () {
    var counter = 0x0000cccc;
    this.next = function () {
        counter++;
        if (counter % 0xffffffffff === 0) counter = 1;
        return this.cur();
    };
    this.cur = function () { return counter.toString(16); };
};

/**
 * Emits:
 * - newBlock(blockTemplate) - When a new block (previously unknown to the JobManager) is added, use this event to broadcast new jobs
 * - share(shareData, blockHex) - When a worker submits a share. It will have blockHex if a block was found
 **/
var JobManager = module.exports = function JobManager(options) {

    //private members
    var _this = this;
    var jobCounter = new JobCounter();

    //public members
    this.currentJob;
    this.meh;
    this.validJobs = {};
    this.extraNonceCounter = new ExtraNonceCounter(options.instanceId);
    this.updateCurrentJob = function (rpcData) {
        var tmpBlockTemplate = new blockTemplate(
            jobCounter.next(),
            rpcData,
            _this.extraNoncePlaceholder,
            options.coin.reward,
            options.recipients,
            options.address,
            options.coin,
            options.pubkey
        );
        _this.currentJob = tmpBlockTemplate;
        //console.log('tmpBlockTemplate: '+JSON.stringify(tmpBlockTemplate));
        _this.emit('updatedBlock', tmpBlockTemplate, true);
        _this.validJobs[tmpBlockTemplate.jobId] = tmpBlockTemplate;

    };

    //returns true if processed a new block
    this.processTemplate = function (rpcData) {

        /* Block is new if A) its the first block we have seen so far or B) the blockhash is different and the
         block height is greater than the one we have */
        var isNewBlock = typeof (_this.currentJob) === 'undefined';
        if (!isNewBlock && _this.currentJob.rpcData.previousblockhash !== rpcData.previousblockhash) {
            isNewBlock = true;
            this.meh = true;
            //If new block is outdated/out-of-sync than return
            if (rpcData.height < _this.currentJob.rpcData.height) return false;
        }
        if (!isNewBlock) {
            this.meh = false;
            return false;
        }
        var tmpBlockTemplate = new blockTemplate(
            jobCounter.next(),
            rpcData,
            _this.extraNoncePlaceholder,
            options.coin.reward,
            options.recipients,
            options.address,
            options.coin,
            options.pubkey
        );
        this.currentJob = tmpBlockTemplate;
        this.validJobs = {};
        _this.emit('newBlock', tmpBlockTemplate);
        this.validJobs[tmpBlockTemplate.jobId] = tmpBlockTemplate;
        return true;
    };

    this.processShare = function (jobId, previousDifficulty, difficulty, extraNonce1, extraNonce2, nTime, nonce, ipAddress, port, workerName, soln) {
        var shareError = function (error) {
            _this.emit('share', { job: jobId, ip: ipAddress, worker: workerName, difficulty: difficulty, error: error[1] });
            return { error: error, result: null };
        };
        var submitTime = Date.now() / 1000 | 0;
        var job = this.validJobs[jobId];
        if (typeof job === 'undefined' || job.jobId != jobId) { return shareError([21, 'job not found']); }
        if (nTime.length !== 8) { return shareError([20, 'incorrect size of ntime']); }

        let nTimeInt = parseInt(nTime.substr(6, 2) + nTime.substr(4, 2) + nTime.substr(2, 2) + nTime.substr(0, 2), 16);
        if (Number.isNaN(nTimeInt)) { return shareError([20, 'invalid ntime']) }
        if (nTimeInt < job.rpcData.curtime || nTimeInt > submitTime + 7200) { return shareError([20, 'ntime out of range']); }
        if (nonce.length !== 64) { return shareError([20, 'incorrect size of nonce']); }
        if (soln.length !== 2694) { return shareError([20, 'incorrect size of solution']); }
        if (!job.registerSubmit(extraNonce1, extraNonce2, nTime, nonce)) { return shareError([22, 'duplicate share']); }

        var headerBuffer = job.serializeHeader(nTime, nonce); // 144 bytes (doesn't contain soln)
        var headerSolnBuffer = Buffer.concat([headerBuffer, Buffer.from(soln, 'hex')]);
        var headerHash = util.sha256d(headerSolnBuffer);
        var headerBigNum = util.bufferToBigInt(headerHash, { endian: 'little' });
        var blockHashInvalid;
        var blockHash;
        var blockHex;
        var shareMultiplier = Math.pow(1, 42);
        // Calculate share difficulty using BigInt arithmetic to avoid overflow
        var diff1BigInt = BigInt(algos.komodo.diff1);
        var shareDiffBigInt = diff1BigInt / headerBigNum;
        var shareDiff = Number(shareDiffBigInt) * shareMultiplier;
        var blockDiffAdjusted = job.difficulty;
        //console.log('shareDiff: '+shareDiff.toFixed(2))
        //console.log('blockDiffAdjusted: '+blockDiffAdjusted.toFixed(2))
        //check if block candidate 
        if (headerBigNum <= job.target) {
            blockHex = job.serializeBlock(headerBuffer, Buffer.from(soln, 'hex')).toString('hex');
            blockHash = util.reverseBuffer(headerHash).toString('hex');
        } else {
            if (options.emitInvalidBlockHashes) {
                blockHex = job.serializeBlock(headerBuffer, Buffer.from(soln, 'hex')).toString('hex');
                blockHash = util.reverseBuffer(headerHash).toString('hex');
            }
        }
        _this.emit('share', {
            job: jobId,
            ip: ipAddress, port: port,
            worker: workerName,
            height: job.rpcData.height,
            blockReward: job.rpcData.miner,
            difficulty: difficulty, shareDiff: shareDiff.toFixed(8), blockDiff: blockDiffAdjusted, blockDiffActual: job.difficulty,
            blockHash: blockHash, blockHashInvalid: blockHashInvalid
        }, blockHex);
        return { result: true, error: null, blockHash: blockHash };
    };
};
JobManager.prototype.__proto__ = events.EventEmitter.prototype;
