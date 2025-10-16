const fs = require('fs');
const net = require('net');
const events = require('events');
const util = require('./util.js');
 
const SubscriptionCounter = function () {
    let count = 0;
    const padding = 'deadbeefcafebabe';
    return {
        next: function () {
            count++;
            if (Number.MAX_VALUE === count) {
                count = 0;
            }
            return padding + util.packInt64LE(count).toString('hex');
        }
    };
};

/**
 * Defining each client that connects to the stratum server.
 * Emits:
 *  - subscription(obj, cback(error, extraNonce1, extraNonce2Size))
 *  - submit(data(name, jobID, extraNonce2, ntime, nonce))
**/
const StratumClient = function (options) {
    let pendingDifficulty = null;
    //private members
    this.socket = options.socket;
    this.remoteAddress = options.socket.remoteAddress;

    const _this = this;
    this.lastActivity = Date.now();
    this.shares = { valid: 0, invalid: 0 };

    this.init = function init() {
        setupSocket();
    };
    function handleMessage(message) {
        switch (message.method) {
        case 'mining.subscribe':
            handleSubscribe(message);
            break;
        case 'mining.authorize':
            handleAuthorize(message);
            break;
        case 'mining.submit':
            _this.lastActivity = Date.now();
            handleSubmit(message);
            break;
        case 'mining.get_transactions':
            sendJson({
                id: null,
                result: [],
                error: true
            });
            break;
        case 'mining.multi_version':
            sendJson({
                id: message.id,
                result: false,
                error: [20, 'Not supported.', null]
            });
            break;
        case 'mining.suggest_target':
            sendJson({
                id: message.id,
                result: false,
                error: [20, 'Not supported.', null]
            });
            break;
        case 'mining.extranonce.subscribe':
            sendJson({
                id: message.id,
                result: false,
                error: [20, 'Not supported.', null]
            });
            break;
        default:
            _this.emit('unknownStratumMethod', message);
            break;
        }
    }

    function handleSubscribe(message) {
        if (!_this.authorized) {
            _this.requestedSubscriptionBeforeAuth = true;
        }
        _this.emit('subscription',
            {},
            function (error, extraNonce1, extraNonce1) {
                if (error) {
                    sendJson({
                        id: message.id,
                        result: null,
                        error: error
                    });
                    return;
                }
                _this.extraNonce1 = extraNonce1;
                sendJson({
                    id: message.id,
                    result: [
                        null, //sessionId
                        extraNonce1
                    ],
                    error: null
                });
            });
    }

    function handleAuthorize(message) {
        if (!message.params) {
            _this.emit('malformedMessage', message);
            return socket.destroy();
        }
        _this.workerName = message.params[0];
        _this.workerPass = message.params[1];
        options.authorizeFn(_this.remoteAddress, options.socket.localPort, _this.workerName, _this.workerPass, function (result) {
            _this.authorized = (!result.error && result.authorized);
            sendJson({
                id: message.id,
                result: _this.authorized,
                error: result.error
            });
            // If the authorizer wants us to close the socket lets do it.
            if (result.disconnect === true) {
                options.socket.destroy();
            }
        });
    }

    function handleSubmit(message) {
        if (!message.params) {
            _this.emit('malformedMessage', message);
            return socket.destroy();
        }
        if (_this.authorized === false) {
            sendJson({
                id: message.id,
                result: null,
                error: [24, 'unauthorized worker', null]
            });
            return;
        }
        if (!_this.extraNonce1) {
            sendJson({
                id: message.id,
                result: null,
                error: [25, 'not subscribed', null]
            });
            return;
        }
        //console.log('id:' + message.params[0]);
        _this.emit('submit',
            {
                name: message.params[0],
                jobId: message.params[1],
                nTime: message.params[2],
                extraNonce2: message.params[3],
                soln: message.params[4],
                nonce: _this.extraNonce1 + message.params[3]
            },
            function (error, result) {

                sendJson({
                    id: message.id,
                    result: true,
                    error: result
                });
                _this.emit(result);

            }
        );
    }

    function sendJson() {
        let response = '';
        for (let i = 0; i < arguments.length; i++) {
            response += JSON.stringify(arguments[i]) + '\n';
        }
        options.socket.write(response);
    }

    function setupSocket() {
        const socket = options.socket;
        let dataBuffer = '';
        socket.setEncoding('utf8');
        if (options.tcpProxyProtocol === true) {
            socket.once('data', function (d) {
                if (d.indexOf('PROXY') === 0) {
                    _this.remoteAddress = d.split(' ')[2];
                } else {
                    _this.emit('tcpProxyError', d);
                }
            });
        }
        socket.on('data', function (d) {
            dataBuffer += d;
            if (Buffer.byteLength(dataBuffer, 'utf8') > 10240) { //10KB
                dataBuffer = '';
                _this.emit('socketFlooded');
                socket.destroy();
                return;
            }
            if (dataBuffer.indexOf('\n') !== -1) {
                const messages = dataBuffer.split('\n');
                const incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop();
                messages.forEach(function (message) {
                    if (message.length < 1) {
                        return;
                    }
                    let messageJson;
                    try {
                        messageJson = JSON.parse(message);
                    } catch (e) {
                        if (options.tcpProxyProtocol !== true || d.indexOf('PROXY') !== 0) {
                            _this.emit('malformedMessage', message);
                            socket.destroy();
                        }
                        return;
                    }
                    if (messageJson) {
                        handleMessage(messageJson);
                    }
                });
                dataBuffer = incomplete;
            }
        });
        socket.on('close', function () {
            _this.emit('socketDisconnect');
        });
        socket.on('error', function (err) {
            if (err.code !== 'ECONNRESET') {
                _this.emit('socketError', err);
            }
        });
    }
    this.getLabel = function () {
        return (_this.workerName || '(unauthorized)') + ' [' + _this.remoteAddress + ']';
    };
    this.enqueueNextDifficulty = function (requestedNewDifficulty) {
        pendingDifficulty = requestedNewDifficulty;
        return true;
    };

    this.sendDifficulty = function (difficulty) {
        const config = JSON.parse(process.env.config);
        //console.log('coin: '+JSON.stringify(config));
        if (difficulty === this.difficulty) {
            return false;
        }

        _this.previousDifficulty = _this.difficulty;
        _this.difficulty = difficulty;
        const powLimit = algos.komodo.diff1;
        const adjPow = (powLimit / difficulty);

        let zeroPad;
        if ((64 - adjPow.toString(16).length) === 0) {
            zeroPad = '';
        } else {
            zeroPad = '0';
            zeroPad = zeroPad.repeat((64 - (adjPow.toString(16).length)));
        }
        const target = (zeroPad + adjPow.toString(16)).substr(0, 64);

        sendJson({
            id: null,
            method: 'mining.set_target',
            params: [target]
        });
        return true;
    };

    this.sendMiningJob = function (jobParams) {
        //console.log('jobParams: '+jobParams);
        const lastActivityAgo = Date.now() - _this.lastActivity;
        if (lastActivityAgo > options.connectionTimeout * 1000) {
            _this.socket.destroy();
            return;
        }
        if (pendingDifficulty !== null) {
            const result = _this.sendDifficulty(pendingDifficulty);
            pendingDifficulty = null;
            if (result) {
                _this.emit('difficultyChanged', _this.difficulty);
            }
        }
        sendJson({
            id: null,
            method: 'mining.notify',
            params: jobParams
        });
    };
    this.manuallyAuthClient = function (username, password) {
        handleAuthorize({ id: 1, params: [username, password] }, false /*do not reply to miner*/);
    };
    this.manuallySetValues = function (otherClient) {
        _this.extraNonce1 = otherClient.extraNonce1;
        _this.previousDifficulty = otherClient.previousDifficulty;
        _this.difficulty = otherClient.difficulty;
    };
};
StratumClient.prototype.__proto__ = events.EventEmitter.prototype;

/**
 * The actual stratum server.
 * It emits the following Events:
 *   - 'client.connected'(StratumClientInstance) - when a new miner connects
 *   - 'client.disconnected'(StratumClientInstance) - when a miner disconnects. Be aware that the socket cannot be used anymore.
 *   - 'started' - when the server is up and running
 **/
const StratumServer = exports.Server = function StratumServer(options, authorizeFn) {
    //private members
    //ports, connectionTimeout, jobRebroadcastTimeout, haproxy, authorizeFn

    const _this = this;
    const stratumClients = {};
    const subscriptionCounter = SubscriptionCounter();
    let rebroadcastTimeout;


    this.handleNewClient = function (socket) {
        socket.setKeepAlive(true);
        const subscriptionId = subscriptionCounter.next();
        const client = new StratumClient(
            {
                subscriptionId: subscriptionId,
                authorizeFn: authorizeFn, //FIXME
                socket: socket,
                connectionTimeout: options.connectionTimeout,
                tcpProxyProtocol: options.tcpProxyProtocol
            }
        );
        stratumClients[subscriptionId] = client;
        _this.emit('client.connected', client);
        client.on('socketDisconnect', function () {
            _this.removeStratumClientBySubId(subscriptionId);
            _this.emit('client.disconnected', client);
        }).init();
        return subscriptionId;
    };

    this.broadcastMiningJobs = function (jobParams) {
        for (const clientId in stratumClients) {
            const client = stratumClients[clientId];
            client.sendMiningJob(jobParams);
        }
        /* Some miners will consider the pool dead if it doesn't receive a job for around a minute.
           So every time we broadcast jobs, set a timeout to rebroadcast in X seconds unless cleared. */
        clearTimeout(rebroadcastTimeout);
        rebroadcastTimeout = setTimeout(function () {
            _this.emit('broadcastTimeout');
        }, options.jobRebroadcastTimeout * 1000);
    };

    (function init() {
        //SetupBroadcasting();
        let serversStarted = 0;
        for (const port in options.ports) {
            net.createServer({ allowHalfOpen: false }, function (socket) {
                _this.handleNewClient(socket);
            }).listen(parseInt(port), function () {
                serversStarted++;
                if (serversStarted == Object.keys(options.ports).length) {
                    _this.emit('started');
                }
            });
        }
    })();

    //public members
    this.getStratumClients = function () {
        return stratumClients;
    };
    this.removeStratumClientBySubId = function (subscriptionId) {
        delete stratumClients[subscriptionId];
    };
    this.manuallyAddStratumClient = function (clientObj) {
        const subId = _this.handleNewClient(clientObj.socket);
        if (subId != null) {
            stratumClients[subId].manuallyAuthClient(clientObj.workerName, clientObj.workerPass);
            stratumClients[subId].manuallySetValues(clientObj);
        }
    };
};
StratumServer.prototype.__proto__ = events.EventEmitter.prototype;
