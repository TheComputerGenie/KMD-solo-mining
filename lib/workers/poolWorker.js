const fs = require('fs');
const net = require('net');
const path = require('path');
const api = require('../modules/api.js');
const Stratum = require('../stratum/index.js');
const logging = require('../modules/logging.js');
const timestamp = require('../modules/timestamp.js');

module.exports = function () {
    var _this = this;
    var config = JSON.parse(process.env.config);
    var forkId = process.env.forkId;
    function authorizeFN(ip, port, workerName, password, callback) {
        logging("PoolWorker", "special", "Authorized " + workerName + ":" + password + "@" + ip, forkId);
        callback({
            error: null,
            authorized: true,
            disconnect: false
        });
    }
    var pool = Stratum.createPool(config, authorizeFN);
    pool.start();
    pool.on('share', function (isValidShare, isValidBlock, data) {
        if (isValidBlock) {
            logging('Blocks', 'special', 'Block found: ' + data.height + ' Hash: ' + data.blockHash + ' block Diff: ' + data.blockDiff)
            api('block', {
                block: data.height,
                hash: data.blockHash,
                finder: data.worker,
                date: new Date().getTime()
            });
        } else if (isValidShare) {
            logging('Blocks', 'special', 'Invalid Low Diff Block Found - Block diff: ' + data.blockDiffActual + ' Found Diff: ' + data.shareDiff, forkId);
        }
        else if (data.blockHash)
            logging('PoolWorker', 'error', 'We thought a block was found but it was rejected by the daemon', forkId)
    });
    pool.on('log', function (severity, logKey, logText) {
        logging('PoolWorker', 'debug', logKey, forkId);
    });
}
