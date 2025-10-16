const net = require('net');
const crypto = require('crypto');
const events = require('events');
const util = require('./util.js');
const logging = require('../modules/logging.js');

const fixedLenStringBuffer = function (s, len) {
    const buff = Buffer.alloc(len);
    buff.fill(0);
    buff.write(s);
    return buff;
};

const commandStringBuffer = function (s) {
    return fixedLenStringBuffer(s, 12);
};

/* Reads a set amount of bytes from a flowing stream, argument descriptions:
 - stream to read from, must have data emitter
 - amount of bytes to read
 - preRead argument can be used to set start with an existing data buffer
 - callback returns 1) data buffer and 2) lopped/over-read data */
const readFlowingBytes = function (stream, amount, preRead, callback) {
    let buff = preRead ? preRead : Buffer.from([]);
    const readData = function (data) {
        buff = Buffer.concat([buff, data]);
        if (buff.length >= amount) {
            const returnData = buff.slice(0, amount);
            const lopped = buff.length > amount ? buff.slice(amount) : null;
            callback(returnData, lopped);
        } else {
            stream.once('data', readData);
        }
    };
    readData(Buffer.from([]));
};

const Peer = module.exports = function (options) {
    const _this = this;
    let client;
    const magic = Buffer.from(options.testnet ? options.coin.peerMagicTestnet : options.coin.peerMagic, 'hex');
    const magicInt = magic.readUInt32LE(0);
    let verack = false;
    let validConnectionConfig = true;
    //https://en.bitcoin.it/wiki/Protocol_specification#Inventory_Vectors
    const invCodes = {
        error: 0,
        tx: 1,
        block: 2
    };
    const networkServices = Buffer.from('0100000000000000', 'hex'); //NODE_NETWORK services (value 1 packed as uint64)
    const emptyNetAddress = Buffer.from('010000000000000000000000000000000000ffff000000000000', 'hex');
    const userAgent = util.varStringBuffer('KMD-solomining');
    const blockStartHeight = Buffer.from('00000000', 'hex'); //block start_height, can be empty
    //If protocol version is new enough, add do not relay transactions flag byte, outlined in BIP37
    //https://github.com/bitcoin/bips/blob/master/bip-0037.mediawiki#extensions-to-existing-messages
    const relayTransactions = options.p2p.disableTransactions === true ? Buffer.from([false]) : Buffer.from([]);
    const commands = {
        version: commandStringBuffer('version'),
        inv: commandStringBuffer('inv'),
        ping: commandStringBuffer('ping'),
        verack: commandStringBuffer('verack'),
        addr: commandStringBuffer('addr'),
        getblocks: commandStringBuffer('getblocks')
    };
    (function init() {
        Connect();
    })();
    function Connect() {
        client = net.connect({
            host: options.p2p.host,
            port: options.p2p.port
        }, () => {
            SendVersion();
        });
        client.on('close', () => {
            if (verack) {
                logging('p2p', 'error', 'disconnected');
                _this.emit('disconnected');
                verack = false;
                Connect();
            } else if (validConnectionConfig) {
                logging('p2p', 'error', 'connectionRejected');
                _this.emit('connectionRejected');
            }
        });
        client.on('error', (e) => {
            if (e.code === 'ECONNREFUSED') {
                logging('p2p', 'error', 'ECONNREFUSED');
                validConnectionConfig = false;
                _this.emit('connectionFailed');
            } else {
                logging('p2p', 'error', e);
            }
            _this.emit('socketError', e);
        });
        SetupMessageParser(client);
    }
    function SetupMessageParser(client) {
        const beginReadingMessage = function (preRead) {
            readFlowingBytes(client, 24, preRead, (header, lopped) => {
                const msgMagic = header.readUInt32LE(0);
                if (msgMagic !== magicInt) {
                    logging('p2p', 'error', 'bad magic number from peer');
                    _this.emit('error', 'bad magic number from peer');
                    while (header.readUInt32LE(0) !== magicInt && header.length >= 4) {
                        header = header.slice(1);
                    }
                    if (header.readUInt32LE(0) === magicInt) {
                        beginReadingMessage(header);
                    } else {
                        beginReadingMessage(Buffer.from([]));
                    }
                    return;
                }
                const msgCommand = header.slice(4, 16).toString();
                const msgLength = header.readUInt32LE(16);
                const msgChecksum = header.readUInt32LE(20);
                readFlowingBytes(client, msgLength, lopped, (payload, lopped) => {
                    if (util.sha256d(payload).readUInt32LE(0) !== msgChecksum) {
                        logging('p2p', 'error', 'bad payload - failed checksum');
                        _this.emit('error', 'bad payload - failed checksum');
                        beginReadingMessage(null);
                        return;
                    }
                    HandleMessage(msgCommand, payload);
                    beginReadingMessage(lopped);
                });
            });
        };
        beginReadingMessage(null);
    }
    //Parsing inv message https://en.bitcoin.it/wiki/Protocol_specification#inv
    function HandleInv(payload) {
        //sloppy varint decoding
        let count = payload.readUInt8(0);
        payload = payload.slice(1);
        if (count >= 0xfd) {
            count = payload.readUInt16LE(0);
            payload = payload.slice(2);
        }
        while (count--) {
            let tx, block;
            switch (payload.readUInt32LE(0)) {
            case invCodes.error:
                break;
            case invCodes.tx:
                tx = payload.slice(4, 36).toString('hex');
                break;
            case invCodes.block:
                block = payload.slice(4, 36).toString('hex');
                _this.emit('blockFound', block);
                break;
            }
            payload = payload.slice(36);
        }
    }
    function HandleMessage(command, payload) {
        switch (command) {
        case commands.inv.toString():
            HandleInv(payload);
            break;
        case commands.verack.toString():
            if (!verack) {
                verack = true;
                _this.emit('connected');
            }
            break;
        case commands.ping.toString():
            //how has this NOT had a feken pong all these years?
            SendMessage(commandStringBuffer('pong'), Buffer.alloc(0));
            break;
        case commands.version.toString():
            SendMessage(commands.verack, Buffer.alloc(0));
            break;
        default:
            break;
        }
    }
    //Message structure defined at: https://en.bitcoin.it/wiki/Protocol_specification#Message_structure
    function SendMessage(command, payload) {
        const message = Buffer.concat([
            magic,
            command,
            util.packUInt32LE(payload.length),
            util.sha256d(payload).slice(0, 4),
            payload
        ]);
        client.write(message);
        _this.emit('sentMessage', message);
    }
    function SendVersion() {
        const payload = Buffer.concat([
            util.packUInt32LE(options.protocolVersion),
            networkServices,
            util.packInt64LE(Date.now() / 1000 | 0),
            emptyNetAddress, //addr_recv, can be empty
            emptyNetAddress, //addr_from, can be empty
            crypto.pseudoRandomBytes(8), //nonce, random unique ID
            userAgent,
            blockStartHeight,
            relayTransactions
        ]);
        SendMessage(commands.version, payload);
    }
};
Peer.prototype.__proto__ = events.EventEmitter.prototype;
