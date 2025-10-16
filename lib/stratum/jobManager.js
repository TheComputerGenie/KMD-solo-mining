const events = require('events');
const crypto = require('crypto');
const util = require('./util.js');
const blockTemplate = require('./blockTemplate.js');

class ExtraNonceCounter {
    constructor(configInstanceId) {
        const instanceId = configInstanceId || crypto.randomBytes(4).readUInt32LE(0);
        let counter = instanceId << 27;
        this.next = function () {
            const extraNonce = util.packUInt32BE(Math.abs(counter++));
            return extraNonce.toString('hex');
        };
        this.size = 4; //bytes
    }
}

class JobCounter {
    constructor() {
        let counter = 0x0000cccc;
        this.next = function () {
            counter++;
            if (counter % 0xffffffffff === 0) {
                counter = 1;
            }
            return this.cur();
        };
        this.cur = function () {
            return counter.toString(16);
        };
    }
}

class JobManager extends events.EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.jobCounter = new JobCounter();
        this.currentJob = null;
        this.validJobs = {};
        this.extraNonceCounter = new ExtraNonceCounter(options.instanceId);
    }

    updateCurrentJob(rpcData) {
        const tmpBlockTemplate = new blockTemplate(
            this.jobCounter.next(),
            rpcData,
            this.extraNoncePlaceholder,
            this.options.coin.reward,
            this.options.recipients,
            this.options.address,
            this.options.coin,
            this.options.pubkey
        );
        this.currentJob = tmpBlockTemplate;
        this.emit('updatedBlock', tmpBlockTemplate, true);
        this.validJobs[tmpBlockTemplate.jobId] = tmpBlockTemplate;
    }

    processTemplate(rpcData) {
        let isNewBlock = this.currentJob === null;
        if (!isNewBlock && this.currentJob.rpcData.previousblockhash !== rpcData.previousblockhash) {
            isNewBlock = true;
            if (rpcData.height < this.currentJob.rpcData.height) {
                return false;
            }
        }
        if (!isNewBlock) {
            return false;
        }
        const tmpBlockTemplate = new blockTemplate(
            this.jobCounter.next(),
            rpcData,
            this.extraNoncePlaceholder,
            this.options.coin.reward,
            this.options.recipients,
            this.options.address,
            this.options.coin,
            this.options.pubkey
        );
        this.currentJob = tmpBlockTemplate;
        this.validJobs = {};
        this.emit('newBlock', tmpBlockTemplate);
        this.validJobs[tmpBlockTemplate.jobId] = tmpBlockTemplate;
        return true;
    }

    processShare(jobId, previousDifficulty, difficulty, extraNonce1, extraNonce2, nTime, nonce, ipAddress, port, workerName, soln) {
        const shareError = (error) => {
            this.emit('share', { job: jobId, ip: ipAddress, worker: workerName, difficulty: difficulty, error: error[1] });
            return { error: error, result: null };
        };

        const submitTime = Date.now() / 1000 | 0;
        const job = this.validJobs[jobId];

        if (!job || job.jobId !== jobId) {
            return shareError([21, 'job not found']);
        }

        if (nTime.length !== 8) {
            return shareError([20, 'incorrect size of ntime']);
        }

        const nTimeInt = parseInt(nTime.substr(6, 2) + nTime.substr(4, 2) + nTime.substr(2, 2) + nTime.substr(0, 2), 16);
        if (isNaN(nTimeInt)) {
            return shareError([20, 'invalid ntime']);
        }

        if (nTimeInt < job.rpcData.curtime || nTimeInt > submitTime + 7200) {
            return shareError([20, 'ntime out of range']);
        }

        if (nonce.length !== 64) {
            return shareError([20, 'incorrect size of nonce']);
        }

        if (soln.length !== 2694) {
            return shareError([20, 'incorrect size of solution']);
        }

        if (!job.registerSubmit(extraNonce1, extraNonce2, nTime, nonce)) {
            return shareError([22, 'duplicate share']);
        }

        const headerBuffer = job.serializeHeader(nTime, nonce);
        const headerSolnBuffer = Buffer.concat([headerBuffer, Buffer.from(soln, 'hex')]);
        const headerHash = util.sha256d(headerSolnBuffer);
        const headerBigNum = util.bufferToBigInt(headerHash, { endian: 'little' });

        let blockHash = null;
        let blockHex = null;

        const diff1BigInt = BigInt(algos.komodo.diff1);
        const shareDiff = Number(diff1BigInt / headerBigNum);
        const blockDiffAdjusted = job.difficulty;

        if (headerBigNum <= job.target) {
            blockHex = job.serializeBlock(headerBuffer, Buffer.from(soln, 'hex')).toString('hex');
            blockHash = util.reverseBuffer(headerHash).toString('hex');
        } else if (this.options.emitInvalidBlockHashes) {
            blockHex = job.serializeBlock(headerBuffer, Buffer.from(soln, 'hex')).toString('hex');
            blockHash = util.reverseBuffer(headerHash).toString('hex');
        }

        this.emit('share', {
            job: jobId,
            ip: ipAddress,
            port: port,
            worker: workerName,
            height: job.rpcData.height,
            blockReward: job.rpcData.miner,
            difficulty: difficulty,
            shareDiff: shareDiff.toFixed(8),
            blockDiff: blockDiffAdjusted,
            blockDiffActual: job.difficulty,
            blockHash: blockHash,
        }, blockHex);

        return { result: true, error: null, blockHash: blockHash };
    }
}

module.exports = JobManager;
