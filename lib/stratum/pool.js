const async = require('async');
const colors = require('colors')
const events = require('events');
const util = require('./util.js');
const peer = require('./peer.js');
const daemon = require('./daemon.js');
const stratum = require('./stratum.js');
const varDiff = require('./varDiff.js');
const jobManager = require('./jobManager.js');
const logging = require('../modules/logging.js');
// TODO: examine and see how much is antiquated leftovers
var pool = module.exports = function pool(options, authorizeFn) {
    this.options = options;
    //console.log(options);
    var _this = this;
    var blockPollingIntervalId;
    var emitLog = function (text) { _this.emit('log', 'debug', text); };
    var emitWarningLog = function (text) { _this.emit('log', 'warning', text); };
    var emitErrorLog = function (text) { _this.emit('log', 'error', text); };
    var emitSpecialLog = function (text) { _this.emit('log', 'special', text); };
    this.start = function () {
        //SetupVarDiff();
        SetupApi();
        SetupDaemonInterface(function () {
            DetectCoinData(function () {
                SetupJobManager();
                OnBlockchainSynced(function () {
                    GetFirstJob(function () {
                        SetupBlockPolling();
                        SetupPeer();
                        StartStratumServer(function () {
                            OutputPoolInfo();
                            _this.emit('started');
                        });
                    });
                });
            });
        });
    };
    function GetFirstJob(finishedCallback) {
        GetBlockTemplate(function (error, result) {
            if (error) {
                emitErrorLog(JSON.stringify(error));
                return;
            }
            var portWarnings = [];
            var networkDiffAdjusted = options.initStats.difficulty;
            Object.keys(options.ports).forEach(function (port) {
                var portDiff = options.ports[port].diff;
                if (networkDiffAdjusted < portDiff)
                    portWarnings.push('port ' + port + ' w/ diff ' + portDiff);
            });
            //Only let the first fork show synced status or the log wil look flooded with it
            if (portWarnings.length > 0 && (!process.env.forkId || process.env.forkId === '0')) {
                var warnMessage = 'Network diff of ' + networkDiffAdjusted + ' is lower than ' +
                    portWarnings.join(' and ');
                emitWarningLog(warnMessage);
            }
            finishedCallback();
        });
    }
    function OutputPoolInfo() {
        var startMessage = 'Stratum Pool Server Started for ' + options.coin.name +
            ' [' + options.coin.symbol.toUpperCase() + ']';
        if (process.env.forkId && process.env.forkId !== '0') {
            emitLog(startMessage);
            return;
        }
        var infoLines = [startMessage,
            'Network Connected:\t' + (options.testnet ? 'Testnet' : 'Mainnet'),
            'Current Connect Peers:\t' + options.initStats.connections,
            'Network Hash Rate:\t' + util.getReadableHashRateString(options.initStats.networkHashRate),
            'Current Block Height:\t' + _this.jobManager.currentJob.rpcData.height,
            'Stratum Port(s):\t' + _this.options.initStats.stratumPorts.join(', '),
            'Current Block Diff:\t' + _this.jobManager.currentJob.difficulty,
            'Network Difficulty:\t' + options.initStats.difficulty
        ];
        if (typeof options.blockRefreshInterval === "number" && options.blockRefreshInterval > 0)
            infoLines.push('Block polling every:\t' + options.blockRefreshInterval + ' seconds');
        emitSpecialLog(infoLines.join('\n\t\t\t\t\t\t'));
    }
    function OnBlockchainSynced(syncedCallback) {
        var checkSynced = function (displayNotSynced) {
            _this.daemon.cmd('getblocktemplate', [], function (results) {
                var synced = results.every(function (r) {
                    return !r.error || r.error.code !== -10;
                });
                if (synced) {
                    syncedCallback();
                } else {
                    if (displayNotSynced) displayNotSynced();
                    setTimeout(checkSynced, 5000);
                    //Only let the first fork show synced status or the log wil look flooded with it
                    if (!process.env.forkId || process.env.forkId === '0')
                        generateProgress();
                }
            });
        };
        checkSynced(function () {
            //Only let the first fork show synced status or the log wil look flooded with it
            if (!process.env.forkId || process.env.forkId === '0')
                emitErrorLog('Daemon is still syncing with network (download blockchain) - server will be started once synced');
        });
        var generateProgress = function () {
            _this.daemon.cmd('getinfo', [], function (results) {
                var blockCount = results.sort(function (a, b) {
                    return b.response.blocks - a.response.blocks;
                })[0].response.blocks;
                //get list of peers and their highest block height to compare to ours
                _this.daemon.cmd('getpeerinfo', [], function (results) {
                    var peers = results[0].response;
                    var totalBlocks = peers.sort(function (a, b) {
                        return b.startingheight - a.startingheight;
                    })[0].startingheight;
                    var percent = (blockCount / totalBlocks * 100).toFixed(2);
                    emitWarningLog('Downloaded ' + percent + '% of blockchain from ' + peers.length + ' peers');
                });
            });
        };
    }
    function SetupApi() {
        if (typeof (options.api) !== 'object' || typeof (options.api.start) !== 'function') { } else {
            options.api.start(_this);
        }
    }
    function SetupPeer() {
        if (!options.p2p || !options.p2p.enabled)
            return;
        if (options.testnet && !options.coin.peerMagicTestnet) {
            emitErrorLog('p2p cannot be enabled in testnet without peerMagicTestnet set in coin configuration');
            return;
        } else if (!options.coin.peerMagic) {
            emitErrorLog('p2p cannot be enabled without peerMagic set in coin configuration');
            return;
        }
        _this.peer = new peer(options);
        _this.peer.on('connected', function () {
            emitLog('p2p connection successful');
        }).on('connectionRejected', function () {
            emitErrorLog('p2p connection failed - likely incorrect p2p magic value');
        }).on('disconnected', function () {
            emitWarningLog('p2p peer node disconnected - attempting reconnection...');
        }).on('connectionFailed', function (e) {
            emitErrorLog('p2p connection failed - likely incorrect host or port');
        }).on('socketError', function (e) {
            emitErrorLog('p2p had a socket error ' + JSON.stringify(e));
        }).on('error', function (msg) {
            emitWarningLog('p2p had an error ' + msg);
        }).on('blockFound', function (hash) {
            _this.processBlockNotify(hash, 'p2p');
        });
    }
    function SubmitBlock(blockHex, callback) {
        var rpcCommand, rpcArgs;
        rpcCommand = 'submitblock';
        rpcArgs = [blockHex];
        _this.daemon.cmd(rpcCommand,
            rpcArgs,
            function (results) {
                for (var i = 0; i < results.length; i++) {
                    var result = results[i];
                    if (result.error) {
                        emitErrorLog('rpc error with daemon instance ' +
                            result.instance.index + ' when submitting block with ' + rpcCommand + ' ' +
                            JSON.stringify(result.error)
                        );
                        return;
                    } else if (result.response === 'rejected') {
                        emitErrorLog('Daemon instance ' + result.instance.index + ' rejected a supposedly valid block');
                        return;
                    }
                }
                emitLog('Submitted Block using ' + rpcCommand + ' successfully to daemon instance(s)');
                callback();
            }
        );
    }

    function SetupJobManager() {
        _this.jobManager = new jobManager(options);
        _this.jobManager.on('newBlock', function (blockTemplate) {
            //Check if stratumServer has been initialized yet
            if (_this.stratumServer) { _this.stratumServer.broadcastMiningJobs(blockTemplate.getJobParams()); }
        }).on('updatedBlock', function (blockTemplate) {
            //Check if stratumServer has been initialized yet
            if (_this.stratumServer) {
                var job = blockTemplate.getJobParams();
                job[8] = false;
                _this.stratumServer.broadcastMiningJobs(job);
            }
        }).on('share', function (shareData, blockHex) {
            var isValidShare = !shareData.error;
            var isValidBlock = !!blockHex;
            var emitShare = function () {
                _this.emit('share', isValidShare, isValidBlock, shareData);
            };
            /*
             If we calculated that the block solution was found,
             before we emit the share, lets submit the block,
             then check if it was accepted using RPC getblock
             */
            if (!isValidBlock)
                emitShare();
            else {
                SubmitBlock(blockHex, function () {
                    CheckBlockAccepted(shareData.blockHash, function (isAccepted, tx) {
                        isValidBlock = isAccepted;
                        shareData.txHash = tx;
                        emitShare();
                        GetBlockTemplate(function (error, result, foundNewBlock) {
                            if (foundNewBlock)
                                emitLog('Block notification via RPC after block submission');
                            //should logger go here?
                        });
                    });
                });
            }
        }).on('log', function (severity, message) {
            _this.emit('log', severity, message);
        });
    }
    function SetupDaemonInterface(finishedCallback) {
        if (!Array.isArray(options.daemons) || options.daemons.length < 1) {
            emitErrorLog('No daemons have been configured - pool cannot start');
            return;
        }
        _this.daemon = new daemon.interface(options.daemons, function (severity, message) {
            _this.emit('log', severity, message);
        });
        _this.daemon.once('online', function () {
            finishedCallback();
        }).on('connectionFailed', function (error) {
            emitErrorLog('Failed to connect daemon(s): ' + JSON.stringify(error));
        }).on('error', function (message) {
            emitErrorLog(message);
        });
        _this.daemon.init();
    }
    function DetectCoinData(finishedCallback) {
        var batchRpcCalls = [
            ['validateaddress', [options.address]],
            ['getinfo', []],
            ['getmininginfo', []]
        ];
        _this.daemon.batchCmd(batchRpcCalls, function (error, results) {
            if (error || !results) {
                emitErrorLog('Could not start pool, error with init batch RPC call: ' + JSON.stringify(error));
                return;
            }
            var rpcResults = {};
            for (var i = 0; i < results.length; i++) {
                var rpcCall = batchRpcCalls[i][0];
                var r = results[i];
                rpcResults[rpcCall] = r.result || r.error;
                if (rpcCall !== 'submitblock' && (r.error || !r.result)) {
                    emitErrorLog('Could not start pool, error with init RPC ' + rpcCall + ' - ' + JSON.stringify(r.error));
                    return;
                }
            }
            if (!rpcResults.validateaddress.isvalid) {
                emitErrorLog('Daemon reports address is not valid');
                return;
            }
            /* if address is owned by wallet.*/
            if (typeof (rpcResults.validateaddress.pubkey) === 'undefined') {
                emitErrorLog('The address provided is not from the daemon wallet');
                return;
            }
            options.poolAddressScript = (function () { return util.addressToScript(rpcResults.validateaddress.address); })();
            options.testnet = rpcResults.getinfo.testnet;
            options.protocolVersion = rpcResults.getinfo.protocolversion;
            options.initStats = {
                connections: rpcResults.getinfo.connections,
                difficulty: rpcResults.getinfo.difficulty,
                networkHashRate: rpcResults.getmininginfo.networksolps
            };
            options.hasSubmitMethod = true;
            finishedCallback();
        });
    }
    function StartStratumServer(finishedCallback) {
        _this.stratumServer = new stratum.Server(options, authorizeFn);
        _this.stratumServer.on('started', function () {
            options.initStats.stratumPorts = Object.keys(options.ports);
            _this.stratumServer.broadcastMiningJobs(_this.jobManager.currentJob.getJobParams());
            finishedCallback();
        }).on('broadcastTimeout', function () {
            if ((process.env.forkId && process.env.forkId == '0') || (!process.env.forkId)) {
                emitLog('No new blocks for ' + options.jobRebroadcastTimeout + ' seconds - updating transactions & rebroadcasting work');
            }
            GetBlockTemplate(function (error, rpcData, processedBlock) {
                if (error || processedBlock) return;
                _this.jobManager.updateCurrentJob(rpcData);
            });
        }).on('client.connected', function (client) {
            client.on('difficultyChanged', function (diff) {
                _this.emit('difficultyUpdate', client.workerName, diff);
            }).on('subscription', function (params, resultCallback) {
                var extraNonce = _this.jobManager.extraNonceCounter.next();
                resultCallback(null,
                    extraNonce,
                    extraNonce
                );
                if (typeof (options.ports[client.socket.localPort]) !== 'undefined') {
                    this.sendDifficulty(_this.jobManager.currentJob.difficulty);
                } else {
                    this.sendDifficulty(_this.jobManager.currentJob.difficulty);
                }
                this.sendMiningJob(_this.jobManager.currentJob.getJobParams());
            }).on('submit', function (params, resultCallback) {
                var result = _this.jobManager.processShare(
                    params.jobId,
                    client.previousDifficulty,
                    client.difficulty,
                    client.extraNonce1,
                    params.extraNonce2,
                    params.nTime,
                    params.nonce,
                    client.remoteAddress,
                    client.socket.localPort,
                    params.name,
                    params.soln
                );
                resultCallback(result.error, result.result ? true : null);
            }).on('malformedMessage', function (message) {
                emitWarningLog('Malformed message from ' + client.getLabel() + ': ' + message);
            }).on('socketError', function (err) {
                emitWarningLog('Socket error from ' + client.getLabel() + ': ' + JSON.stringify(err));
            }).on('socketTimeout', function (reason) {
                emitWarningLog('Connected timed out for ' + client.getLabel() + ': ' + reason)
            }).on('socketDisconnect', function () {
                logging("PoolWorker", "error", "Socket disconnected " + client.getLabel());
            }).on('unknownStratumMethod', function (fullMessage) {
                emitLog('Unknown stratum method from ' + client.getLabel() + ': ' + fullMessage.method);
            }).on('socketFlooded', function () {
                emitWarningLog('Detected socket flooding from ' + client.getLabel());
            }).on('tcpProxyError', function (data) {
                emitErrorLog('Client IP detection failed, tcpProxyProtocol is enabled yet did not receive proxy protocol message, instead got data: ' + data);
            });
        });
    }
    function SetupBlockPolling() {
        if (typeof options.blockRefreshInterval !== "number" || options.blockRefreshInterval <= 0) {
            emitLog('Block template polling has been disabled');
            return;
        }
        var pollingInterval = options.blockRefreshInterval;
        blockPollingIntervalId = setInterval(function () {
            GetBlockTemplate(function (error, result, foundNewBlock) {
                if (foundNewBlock) {
                    if (!process.env.forkId || process.env.forkId === '0') { emitLog('Block notification via RPC polling'); }
                }
            });
        }, pollingInterval * 1000);
    }
    function GetBlockTemplate(callback) {
        function getBlockSubsidyandTemplate(callback) {
            _this.daemon.cmd('getblocksubsidy', [],
                function (result) {
                    callback = function (subsidy) {
                        getBlockTemplate(subsidy)
                    };
                    var subsidy = result[0].response;
                    callback(subsidy);
                });
        }
        function getBlockTemplate(subsidy) {
            _this.daemon.cmd('getblocktemplate', [{ "capabilities": ["coinbasetxn", "workid", "coinbase/append"] }],
                function (result) {
                    if (result.error) {
                        if (result.response == null) {
                            console.log('wait loop data: ' + JSON.stringify(result));
                            //given the randomness of "Cannot get a block template while no peers are connected or chain not in sync!"
                            //while having peers and being in sync, this might be a Komodo, networking, or rpcworkqueue bug.
                            //retry seems to work after a few seconds wait...
                            setTimeout(getBlockSubsidyandTemplate, 4000);
                        } else {
                            emitErrorLog('getblocktemplate call failed for daemon instance ' +
                                result.instance.index + ' with error ' + JSON.stringify(result));
                            callback(result.error);
                        }
                    } else {
                        result.response.miner = subsidy.miner;
                        var processedNewBlock = _this.jobManager.processTemplate(result.response);
                        callback(null, result.response, processedNewBlock);
                        callback = function () { };
                    }
                }, true
            );
        }
        getBlockSubsidyandTemplate();
    }
    function CheckBlockAccepted(blockHash, callback) {
        _this.daemon.cmd('getblock', [blockHash],
            function (results) {
                var validResults = results.filter(function (result) { return result.response && (result.response.hash === blockHash) });
                validResults.length >= 1 ? callback(true, validResults[0].response.tx[0]) : callback(false)
            }
        );
    }
    /**
     * This method is being called from the blockNotify so that when a new block is discovered by the daemon
     * We can inform our miners about the newly found block
     **/
    this.processBlockNotify = function (blockHash, sourceTrigger) {
        if (!process.env.forkId || process.env.forkId === '0') {
            //console.log(_this.jobManager.meh);
            var logheight = JSON.stringify(_this.jobManager.currentJob.rpcData.height);
            emitLog('Block notification via ' + sourceTrigger + ' -->> Block: ' + (_this.jobManager.meh === false ? logheight : (logheight - 1)));
        }
        if (typeof (_this.jobManager) !== 'undefined' && typeof (_this.jobManager.currentJob) !== 'undefined' &&
            typeof (_this.jobManager.currentJob.rpcData.previousblockhash) !== 'undefined' &&
            blockHash !== _this.jobManager.currentJob.rpcData.previousblockhash) {
            GetBlockTemplate(function (error, result) {
                if (error)
                    emitErrorLog('Block notify error getting block template for ' + options.coin.name);
            })
        }
    };
    this.relinquishMiners = function (filterFn, resultCback) {
        var origStratumClients = this.stratumServer.getStratumClients();
        var stratumClients = [];
        Object.keys(origStratumClients).forEach(function (subId) {
            stratumClients.push({ subId: subId, client: origStratumClients[subId] });
        });
        async.filter(stratumClients, filterFn, function (clientsToRelinquish) {
            clientsToRelinquish.forEach(function (cObj) {
                cObj.client.removeAllListeners();
                _this.stratumServer.removeStratumClientBySubId(cObj.subId);
            });
            process.nextTick(function () {
                resultCback(
                    clientsToRelinquish.map(function (item) { return item.client; })
                );
            });
        })
    };
    this.attachMiners = function (miners) {
        miners.forEach(function (clientObj) { _this.stratumServer.manuallyAddStratumClient(clientObj); });
        _this.stratumServer.broadcastMiningJobs(_this.jobManager.currentJob.getJobParams());
    };
    this.getStratumServer = function () { return _this.stratumServer; };
};
pool.prototype.__proto__ = events.EventEmitter.prototype;
