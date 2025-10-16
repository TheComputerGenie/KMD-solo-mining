const api = require('../modules/api.js');
const Stratum = require('../stratum/index.js');
const logging = require('../modules/logging.js');
const init = require('../../init')
module.exports = function () {
    const config = JSON.parse(process.env.config);
    const coin = config.coin.name;
    const coinSymbol = config.coin.symbol;
    const forkId = process.env.forkId;
    function authorizeFN(ip, port, workerName, password, callback) {
        logging("PoolWorker", "special", "Authorized " + workerName + ":" + ip, forkId);
        callback({
            error: null,
            authorized: true,
            disconnect: false
        });
    }
    const pool = Stratum.createPool(config, authorizeFN);
    pool.start();
    pool.on('share', function (isValidShare, isValidBlock, data) {
        if (isValidBlock) {
            logging('Blocks', 'special', 'Block found: ' + data.height + ' Hash: ' + data.blockHash + ' block Diff: ' + data.blockDiff + ' data: ' + JSON.stringify(data))
            api('block', {
                block: data.height,
                hash: data.blockHash,
                finder: data.worker,
                date: new Date().getTime()
            }, coinSymbol);
        }
        if (isValidShare) {
            //silly to use case here, but...
            switch (true) {
            case (data.shareDiff > 1000000000):
                logging('PoolWorker', 'error', 'Share was found with diff higher than 1,000,000,000! ' + data.shareDiff);
                break;
            case (data.shareDiff > 100000000):
                logging('PoolWorker', 'special', 'Share was found with diff higher than 100,000,000! ' + data.shareDiff);
                break;
            case (data.shareDiff > 10000000):
                logging('PoolWorker', 'special', 'Share was found with diff higher than 10,000,000! ' + data.shareDiff);
                break;
            }
            if (config.printShares) {
                if (data.blockDiffActual > data.shareDiff) {
                    sillyPercent = ((data.shareDiff * 100) / data.blockDiffActual); //percent is meaningless, but it makes us feel good to see on higher diff chains like KMD 
                    logging('PoolWorker', 'debug', 'Share accepted - Block diff: ' + data.blockDiffActual + ' Share Diff: ' + data.shareDiff + ' (' + sillyPercent.toFixed(2) + '%)');
                } else {
                    logging('PoolWorker', 'special', 'Share accepted - Block diff: ' + data.blockDiffActual + ' Share Diff: ' + data.shareDiff);
                }
            }
        } else if (data.blockHash) {
            logging('PoolWorker', 'error', 'We thought a block was found but it was rejected by the daemon', forkId)
        }
    });
}
