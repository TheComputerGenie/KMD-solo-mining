const fs = require('fs');
const os = require('os');
const cluster = require('cluster');
const config = require('./config.json');
const Website = require('./lib/workers/website.js');
const logging = require('./lib/modules/logging.js');
const PoolWorker = require('./lib/workers/poolWorker.js');
const CliListener = require('./lib/workers/cliListener.js');

var coinFilePath = 'coins/' + config.coin;

if (!fs.existsSync(coinFilePath)) {
    console.log('Master', config.coin, 'could not find file: ' + coinFilePath);
    return;
}

var coinProfile = JSON.parse(fs.readFileSync(coinFilePath, {
    encoding: 'utf8'
}));

config.coin = coinProfile;

exports.cconfig = coinProfile;


//console.log('config.coin: ', config.coin)
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
    var numForks = (function () {
        if (!config.clustering || !config.clustering.enabled)
            return 1;
        if (config.clustering.forks === 'auto')
            return os.cpus().length;
        if (!config.clustering.forks || isNaN(config.clustering.forks))
            return 1;
        return config.clustering.forks;
    })();

    var poolWorkers = {};

    function createPoolWorker(forkId) {
        var worker = cluster.fork({
            workerType: 'pool',
            forkId: forkId,
            config: JSON.stringify(config)
        });
        worker.forkId = forkId;
        worker.type = 'pool';
        poolWorkers[forkId] = worker;
        worker.on('exit', function (code, signal) {
            logging('Pool', 'error', 'Fork ' + forkId + ' died, spawning replacement worker...', forkId)
            setTimeout(function () {
                createPoolWorker(forkId);
            }, 2000);
        }).on('message', function (msg) { });
    }

    var i = 0;
    var spawnInterval = setInterval(function () {
        createPoolWorker(i);
        i++;
        if (i == numForks) {
            clearInterval(spawnInterval);
            logging('Init', 'debug', 'Spawned proxy on ' + numForks + ' threads(s)')
        }
    }, 250);
}

function startCliListener() {
    var cliPort = config.cliPort;

    var listener = new CliListener(cliPort);
    listener.on('log', function (text) {
        console.log('CLI: ' + text);
    }).on('command', function (command, params, options, reply) {

        switch (command) {
            case 'blocknotify':
                Object.keys(cluster.workers).forEach(function (id) {
                    cluster.workers[id].send({
                        type: 'blocknotify',
                        coin: params[0],
                        hash: params[1]
                    });
                });
                reply('Workers notified');
                break;
            default:
                reply('unrecognized command "' + command + '"');
                break;
        }
    }).start();
}

function startWebsite() {
    if (!config.website.enabled) return;

    var worker = cluster.fork({
        workerType: 'website',
        config: JSON.stringify(config)
    });
    worker.on('exit', function (code, signal) {
        logging('Website', 'error', 'Website process died, spawning replacement...')
        setTimeout(function () {
            startWebsite(config);
        }, 2000);
    });
}

function createEmptyLogs() {
    try {
        fs.readFileSync('./logs/blocks.json')
    } catch (err) {
        err.code === "ENOENT" ? fs.writeFileSync('./logs/blocks.json', '[]') : (function () { throw err }());
    }
}

(function init() {
    createEmptyLogs();
    spawnPoolWorkers();
    startCliListener();
    startWebsite();
})();
