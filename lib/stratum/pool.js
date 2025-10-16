const events = require('events');
const util = require('./util.js');
const peer = require('./peer.js');
const daemon = require('./daemon.js');
const stratum = require('./stratum.js');
const jobManager = require('./jobManager.js');
const logging = require('../modules/logging.js');

const pool = module.exports = class Pool extends events.EventEmitter {
    constructor(options, authorizeFn) {
        super();
        this.options = options;
        this.authorizeFn = authorizeFn;
        this.blockPollingIntervalId = null;

        process.on('message', (msg) => {
            if (msg.type === 'blocknotify') {
                this.processBlockNotify(msg.hash, 'rpc');
            }
        });
    }

    log(severity, text) {
        logging('Stratum', severity, text);
    }

    start() {
        this.setupApi();
        this.setupDaemonInterface(() => {
            this.detectCoinData(() => {
                this.setupJobManager();
                this.onBlockchainSynced(() => {
                    this.getFirstJob(() => {
                        this.setupBlockPolling();
                        this.setupPeer();
                        this.startStratumServer(() => {
                            this.outputPoolInfo();
                            this.emit('started');
                        });
                    });
                });
            });
        });
    }

    getFirstJob(finishedCallback) {
        this.getBlockTemplate((error, result) => {
            if (error) {
                this.log('error', JSON.stringify(error));
                return;
            }
            const portWarnings = [];
            const networkDiffAdjusted = this.options.initStats.difficulty;
            Object.keys(this.options.ports).forEach((port) => {
                const portDiff = this.options.ports[port].diff;
                if (networkDiffAdjusted < portDiff) {
                    portWarnings.push(`port ${port} w/ diff ${portDiff}`);
                }
            });

            if (portWarnings.length > 0 && (!process.env.forkId || process.env.forkId === '0')) {
                const warnMessage = `Network diff of ${networkDiffAdjusted} is lower than ${portWarnings.join(' and ')}`;
                this.log('warning', warnMessage);
            }
            finishedCallback();
        });
    }

    outputPoolInfo() {
        const startMessage = `Stratum Pool Server Started for ${this.options.coin.name} [${this.options.coin.symbol.toUpperCase()}]`;
        if (process.env.forkId && process.env.forkId !== '0') {
            this.log('debug', startMessage);
            return;
        }
        const infoLines = [
            startMessage,
            `Network Connected:\t${this.options.testnet ? 'Testnet' : 'Mainnet'}`,
            `Current Connect Peers:\t${this.options.initStats.connections}`,
            `Network Hash Rate:\t${util.getReadableHashRateString(this.options.initStats.networkHashRate)}`,
            `Current Block Height:\t${this.jobManager.currentJob.rpcData.height}`,
            `Stratum Port(s):\t${this.options.initStats.stratumPorts.join(', ')}`,
            `Current Block Diff:\t${this.jobManager.currentJob.difficulty}`,
            `Network Difficulty:\t${this.options.initStats.difficulty}`
        ];
        if (typeof this.options.blockRefreshInterval === 'number' && this.options.blockRefreshInterval > 0) {
            infoLines.push(`Block polling every:\t${this.options.blockRefreshInterval} seconds`);
        }
        this.log('special', infoLines.join('\n\t\t\t\t\t\t'));
    }

    onBlockchainSynced(syncedCallback) {
        const checkSynced = (displayNotSynced) => {
            this.daemon.cmd('getblocktemplate', [], (results) => {
                const synced = results.every((r) => !r.error || r.error.code !== -10);
                if (synced) {
                    syncedCallback();
                } else {
                    if (displayNotSynced) {
                        displayNotSynced();
                    }
                    setTimeout(checkSynced, 5000);
                    if (!process.env.forkId || process.env.forkId === '0') {
                        this.generateProgress();
                    }
                }
            });
        };
        checkSynced(() => {
            if (!process.env.forkId || process.env.forkId === '0') {
                this.log('error', 'Daemon is still syncing with network (download blockchain) - server will be started once synced');
            }
        });
    }

    generateProgress() {
        this.daemon.cmd('getinfo', [], (results) => {
            const blockCount = results.sort((a, b) => b.response.blocks - a.response.blocks)[0].response.blocks;
            this.daemon.cmd('getpeerinfo', [], (peerResults) => {
                const peers = peerResults[0].response;
                if (peers && peers.length > 0) {
                    const totalBlocks = peers.sort((a, b) => b.startingheight - a.startingheight)[0].startingheight;
                    const percent = (blockCount / totalBlocks * 100).toFixed(2);
                    this.log('warning', `Downloaded ${percent}% of blockchain from ${peers.length} peers`);
                }
            });
        });
    }

    setupApi() {
        if (this.options.api && typeof this.options.api.start === 'function') {
            this.options.api.start(this);
        }
    }

    setupPeer() {
        if (!this.options.p2p || !this.options.p2p.enabled) {
            return;
        }
        if (this.options.testnet && !this.options.coin.peerMagicTestnet) {
            this.log('error', 'p2p cannot be enabled in testnet without peerMagicTestnet set in coin configuration');
            return;
        }
        if (!this.options.coin.peerMagic) {
            this.log('error', 'p2p cannot be enabled without peerMagic set in coin configuration');
            return;
        }
        this.peer = new peer(this.options);
        this.peer.on('connected', () => this.log('debug', 'p2p connection successful'))
            .on('connectionRejected', () => this.log('error', 'p2p connection failed - likely incorrect p2p magic value'))
            .on('disconnected', () => this.log('warning', 'p2p peer node disconnected - attempting reconnection...'))
            .on('connectionFailed', () => this.log('error', 'p2p connection failed - likely incorrect host or port'))
            .on('socketError', (e) => this.log('error', `p2p had a socket error ${JSON.stringify(e)}`))
            .on('error', (msg) => this.log('warning', `p2p had an error ${msg}`))
            .on('blockFound', (hash) => this.processBlockNotify(hash, 'p2p'));
    }

    submitBlock(blockHex, callback) {
        this.daemon.cmd('submitblock', [blockHex], (results) => {
            for (let i = 0; i < results.length; i++) {
                const result = results[i];
                if (result.error) {
                    this.log('error', `rpc error with daemon instance ${result.instance.index} when submitting block with submitblock ${JSON.stringify(result.error)}`);
                    return;
                }
                if (result.response === 'rejected') {
                    this.log('error', `Daemon instance ${result.instance.index} rejected a supposedly valid block`);
                    return;
                }
            }
            if (this.options.printSubmissions) {
                logging('Blocks', 'debug', 'Submitted Block using submitblock successfully to daemon instance(s)');
            }
            callback();
        });
    }

    setupJobManager() {
        this.jobManager = new jobManager(this.options);
        this.jobManager.on('newBlock', (blockTemplate) => {
            if (this.stratumServer) {
                this.stratumServer.broadcastMiningJobs(blockTemplate.getJobParams());
            }
        }).on('updatedBlock', (blockTemplate) => {
            if (this.stratumServer) {
                const job = blockTemplate.getJobParams();
                job[7] = false;
                this.stratumServer.broadcastMiningJobs(job);
            }
        }).on('share', (shareData, blockHex) => {
            const isValidShare = !shareData.error;
            let isValidBlock = !!blockHex;
            const emitShare = () => {
                this.emit('share', isValidShare, isValidBlock, shareData);
            };

            if (!isValidBlock) {
                emitShare();
            } else {
                this.submitBlock(blockHex, () => {
                    this.checkBlockAccepted(shareData.blockHash, (isAccepted, tx) => {
                        isValidBlock = isAccepted;
                        shareData.txHash = tx;
                        emitShare();
                        this.getBlockTemplate((error, result, foundNewBlock) => {
                            if (foundNewBlock) {
                                this.log('debug', 'Block notification via RPC after block submission');
                            }
                        });
                    });
                });
            }
        }).on('log', (severity, message) => {
            this.emit('log', severity, message);
        });
    }

    setupDaemonInterface(finishedCallback) {
        if (!Array.isArray(this.options.daemons) || this.options.daemons.length < 1) {
            this.log('error', 'No daemons have been configured - pool cannot start');
            return;
        }
        this.daemon = new daemon.interface(this.options.daemons, (severity, message) => {
            this.emit('log', severity, message);
        });
        this.daemon.once('online', finishedCallback)
            .on('connectionFailed', (error) => this.log('error', `Failed to connect daemon(s): ${JSON.stringify(error)}`))
            .on('error', (message) => this.log('error', message));
        this.daemon.init();
    }

    detectCoinData(finishedCallback) {
        const batchRpcCalls = [
            ['validateaddress', [this.options.address]],
            ['getinfo', []],
            ['getmininginfo', []]
        ];
        this.daemon.batchCmd(batchRpcCalls, (error, results) => {
            if (error || !results) {
                this.log('error', `Could not start pool, error with init batch RPC call: ${JSON.stringify(error)}`);
                return;
            }
            const rpcResults = {};
            for (let i = 0; i < results.length; i++) {
                const rpcCall = batchRpcCalls[i][0];
                const r = results[i];
                rpcResults[rpcCall] = r.result || r.error;
                if (rpcCall !== 'submitblock' && (r.error || !r.result)) {
                    this.log('error', `Could not start pool, error with init RPC ${rpcCall} - ${JSON.stringify(r.error)}`);
                    return;
                }
            }
            if (!rpcResults.validateaddress.isvalid) {
                this.log('error', 'Daemon reports address is not valid');
                return;
            }
            if (typeof (rpcResults.validateaddress.pubkey) === 'undefined') {
                this.log('error', 'The address provided is not from the daemon wallet');
            }
            this.options.poolAddressScript = util.addressToScript(rpcResults.validateaddress.address);
            this.options.testnet = rpcResults.getinfo.testnet;
            this.options.protocolVersion = rpcResults.getinfo.protocolversion;
            this.options.initStats = {
                connections: rpcResults.getinfo.connections,
                difficulty: rpcResults.getinfo.difficulty,
                networkHashRate: rpcResults.getmininginfo.networksolps
            };
            this.options.hasSubmitMethod = true;
            finishedCallback();
        });
    }

    startStratumServer(finishedCallback) {
        this.stratumServer = new stratum.Server(this.options, this.authorizeFn);
        this.stratumServer.on('started', () => {
            this.options.initStats.stratumPorts = Object.keys(this.options.ports);
            this.stratumServer.broadcastMiningJobs(this.jobManager.currentJob.getJobParams());
            finishedCallback();
        }).on('broadcastTimeout', () => {
            if ((process.env.forkId && process.env.forkId === '0') || (!process.env.forkId)) {
                this.log('debug', `No new blocks for ${this.options.jobRebroadcastTimeout} seconds - updating transactions & rebroadcasting work`);
            }
            this.getBlockTemplate((error, rpcData, processedBlock) => {
                if (error || processedBlock) {
                    return;
                }
                this.jobManager.updateCurrentJob(rpcData);
            });
        }).on('client.connected', (client) => {
            client.on('difficultyChanged', (diff) => {
                this.emit('difficultyUpdate', client.workerName, diff);
            }).on('subscription', (params, resultCallback) => {
                const extraNonce = this.jobManager.extraNonceCounter.next();
                resultCallback(null, extraNonce, extraNonce);

                if (this.options.ports[client.socket.localPort]) {
                    if (this.options.minDiffAdjust && this.options.minDiffAdjust.toString() === 'true') {
                        client.sendDifficulty(this.options.ports[client.socket.localPort].diff);
                    } else {
                        client.sendDifficulty(this.jobManager.currentJob.difficulty);
                    }
                } else {
                    client.sendDifficulty(this.jobManager.currentJob.difficulty);
                }

                client.sendMiningJob(this.jobManager.currentJob.getJobParams());
            }).on('submit', (params, resultCallback) => {
                const result = this.jobManager.processShare(
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
            }).on('malformedMessage', (message) => this.log('warning', `Malformed message from ${client.getLabel()}: ${message}`))
                .on('socketError', (err) => this.log('warning', `Socket error from ${client.getLabel()}: ${JSON.stringify(err)}`))
                .on('socketTimeout', (reason) => this.log('warning', `Connected timed out for ${client.getLabel()}: ${reason}`))
                .on('socketDisconnect', () => logging('PoolWorker', 'error', `Socket disconnected ${client.getLabel()}`))
                .on('unknownStratumMethod', (fullMessage) => this.log('debug', `Unknown stratum method from ${client.getLabel()}: ${fullMessage.method}`))
                .on('socketFlooded', () => this.log('warning', `Detected socket flooding from ${client.getLabel()}`))
                .on('tcpProxyError', (data) => this.log('error', `Client IP detection failed, tcpProxyProtocol is enabled yet did not receive proxy protocol message, instead got data: ${data}`));
        });
    }

    setupBlockPolling() {
        if (typeof this.options.blockRefreshInterval !== 'number' || this.options.blockRefreshInterval <= 0) {
            this.log('debug', 'Block template polling has been disabled');
            return;
        }
        const pollingInterval = this.options.blockRefreshInterval;
        this.blockPollingIntervalId = setInterval(() => {
            this.getBlockTemplate((error, result, foundNewBlock) => {
                if (foundNewBlock && (!process.env.forkId || process.env.forkId === '0')) {
                    this.log('debug', 'Block notification via RPC polling');
                }
            });
        }, pollingInterval * 1000);
    }

    getBlockTemplate(callback) {
        const getRawTransaction = (template) => {
            template.miner = template.coinbasetxn.coinbasevalue / 1e8;
            template.miner = parseFloat(template.miner.toFixed(8));
            this.daemon.cmd('decoderawtransaction', [template.coinbasetxn.data], (result) => {
                if (result.error) {
                    this.log('error', `decoderawtransaction call failed for daemon instance ${result.instance.index} with error ${JSON.stringify(result.error)}`);
                    callback(result.error);
                } else {
                    template.vouts = result.response.vout;
                    const processedNewBlock = this.jobManager.processTemplate(template);
                    callback(null, template, processedNewBlock);
                }
            }, true);
        };

        const getBlockSubsidyandTemplate = () => {
            this.daemon.cmd('getblocktemplate', [{ capabilities: ['coinbasetxn', 'workid', 'coinbase/append'] }], (result) => {
                if (result.error) {
                    this.log('error', `getblocktemplate call failed for daemon instance ${result.instance.index} with error ${JSON.stringify(result.error)}`);
                    callback(result.error);
                } else if (!result[0].response || !result[0].response.coinbasetxn) {
                    this.log('error', `getblocktemplate call failed with invalid response: ${JSON.stringify(result)}`);
                    setTimeout(getBlockSubsidyandTemplate, 1000);
                } else {
                    getRawTransaction(result[0].response);
                }
            });
        };

        getBlockSubsidyandTemplate();
    }

    checkBlockAccepted(blockHash, callback) {
        this.daemon.cmd('getblock', [blockHash], (results) => {
            const validResults = results.filter((result) => result.response && result.response.hash === blockHash);
            if (validResults.length >= 1) {
                callback(true, validResults[0].response.tx[0]);
            } else {
                callback(false);
            }
        });
    }

    processBlockNotify(blockHash, sourceTrigger) {
        if (!process.env.forkId || process.env.forkId === '0') {
            this.log('debug', `Block notification via ${sourceTrigger} -->> Block: ${this.jobManager.currentJob.rpcData.height}`);
        }
        if (this.jobManager && this.jobManager.currentJob && this.jobManager.currentJob.rpcData.previousblockhash && blockHash !== this.jobManager.currentJob.rpcData.previousblockhash) {
            this.getBlockTemplate((error) => {
                if (error) {
                    this.log('error', `Block notify error getting block template for ${this.options.coin.name}`);
                }
            });
        }
    }
};
pool.prototype.__proto__ = events.EventEmitter.prototype;
