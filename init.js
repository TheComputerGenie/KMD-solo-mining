const fs = require('fs');
const os = require('os');
const cluster = require('cluster');
const systemConfig = require('./system-config.json');
const Website = require('./lib/workers/website.js');
const logging = require('./lib/modules/logging.js');
const PoolWorker = require('./lib/workers/poolWorker.js');
const CliListener = require('./lib/workers/cliListener.js');

// Get coin symbol from command line arguments, default to KMD
const coinSymbol = process.argv[2] || 'KMD';
const coinFilePath = `coin_configs/${  coinSymbol  }.json`;

if (!fs.existsSync(coinFilePath)) {
    console.log('Master', coinSymbol, `could not find file: ${  coinFilePath}`);
    return;
}

const coinProfile = JSON.parse(fs.readFileSync(coinFilePath, { encoding: 'utf8' }));

// Merge system config with coin config
const config = Object.assign({}, systemConfig, coinProfile);
config.coin = coinProfile;
exports.cconfig = coinProfile;

if (cluster.isWorker) {
    switch (process.env.workerType) {
    case 'pool':
        new PoolWorker();
        break;
    case 'website':
        new Website();
        break;
    }
    return;
}


function spawnPoolWorkers() {
    let numForks;
    if (!config.clustering || !config.clustering.enabled) {
        numForks = 1;
    } else if (config.clustering.forks === 'auto') {
        numForks = os.cpus().length;
    } else if (!config.clustering.forks || isNaN(config.clustering.forks)) {
        numForks = 1;
    } else {
        numForks = config.clustering.forks;
    }

    const poolWorkers = {};

    function createPoolWorker(forkId) {
        const worker = cluster.fork({
            workerType: 'pool',
            forkId: forkId,
            config: JSON.stringify(config)
        });
        worker.forkId = forkId;
        worker.type = 'pool';
        poolWorkers[forkId] = worker;
        worker.on('exit', (code, signal) => {
            logging('Pool', 'error', `Fork ${  forkId  } died, spawning replacement worker...`, forkId);
            setTimeout(() => {
                createPoolWorker(forkId);
            }, 2000);
        }).on('message', (msg) => { });
    }

    let i = 0;
    const spawnInterval = setInterval(() => {
        createPoolWorker(i);
        i++;
        if (i == numForks) {
            clearInterval(spawnInterval);
            logging('Init', 'debug', `Spawned proxy on ${  numForks  } threads(s)`);
        }
    }, 250);
}

function startCliListener() {
    const cliPort = config.cliPort;

    const listener = new CliListener(cliPort);
    listener.on('log', (text) => {
        console.log(`CLI: ${  text}`);
    }).on('command', (command, params, options, reply) => {

        switch (command) {
        case 'blocknotify':
            Object.keys(cluster.workers).forEach((id) => {
                cluster.workers[id].send({
                    type: 'blocknotify',
                    coin: params[0],
                    hash: params[1]
                });
            });
            reply('Workers notified');
            break;
        default:
            reply(`unrecognized command "${  command  }"`);
            break;
        }
    }).start();
}

function startWebsite() {
    if (!config.website.enabled) {
        return;
    }

    const worker = cluster.fork({
        workerType: 'website',
        config: JSON.stringify(config)
    });
    worker.on('exit', (code, signal) => {
        logging('Website', 'error', 'Website process died, spawning replacement...');
        setTimeout(() => {
            startWebsite(config);
        }, 2000);
    });
}

function createEmptyLogs() {
    const logPath = `./block_logs/${coinSymbol}_blocks.json`;
    if (!fs.existsSync(logPath)) {
        fs.writeFileSync(logPath, '[]');
    }
}

(function init() {
    createEmptyLogs();
    spawnPoolWorkers();
    startCliListener();
    startWebsite();
})();
