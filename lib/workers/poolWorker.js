// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const api = require('../modules/api.js');
const Stratum = require('../stratum/index.js');
const logging = require('../modules/logging.js');

module.exports = function () {
    const config = JSON.parse(process.env.config);
    const coinSymbol = config.coin.symbol;
    const forkId = process.env.forkId;

    const authorizeFN = (ip, port, workerName, password, callback) => {
        logging('PoolWorker', 'special', `Authorized ${workerName}:${ip}`, forkId);
        callback({
            error: null,
            authorized: true,
            disconnect: false
        });
    };

    const pool = Stratum.createPool(config, authorizeFN);
    pool.start();

    pool.on('share', (isValidShare, isValidBlock, data) => {
        if (isValidBlock) {
            const blockData = {
                block: data.height,
                hash: data.blockHash,
                finder: data.worker,
                date: Date.now()
            };
            logging('Blocks', 'special', `Network Accepted Block: ${data.height} Hash: ${data.blockHash}`);
            api('block', blockData, coinSymbol);
        }

        if (isValidShare) {
            if (data.shareDiff > 1000000000) {
                logging('PoolWorker', 'error', `Share was found with diff higher than 1,000,000,000! ${data.shareDiff}`);
            } else if (data.shareDiff > 100000000) {
                logging('PoolWorker', 'special', `Share was found with diff higher than 100,000,000! ${data.shareDiff}`);
            } else if (data.shareDiff > 10000000) {
                logging('PoolWorker', 'special', `Share was found with diff higher than 10,000,000! ${data.shareDiff}`);
            }

            if (config.printShares) {
                let logMessage = `Share accepted - Block diff: ${data.blockDiffActual} Share Diff: ${data.shareDiff}`;
                if (data.blockDiffActual > data.shareDiff) {
                    const sillyPercent = (data.shareDiff * 100) / data.blockDiffActual;
                    logMessage += ` (${sillyPercent.toFixed(2)}%)`;
                    logging('PoolWorker', 'debug', logMessage);
                } else {
                    logging('PoolWorker', 'special', logMessage);
                }
            }
        } else if (data.blockHash) {
            logging('PoolWorker', 'error', 'We thought a block was found but it was rejected by the daemon', forkId);
        }
    });
};
