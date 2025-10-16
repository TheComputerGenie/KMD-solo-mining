const http = require('http');
const async = require('async');
const events = require('events');
const cp = require('child_process');

/**
 * The daemon interface interacts with the coin daemon by using the rpc interface.
 * in order to make it work it needs, as constructor, an array of objects containing
 * - 'host'    : hostname where the coin lives
 * - 'port'    : port where the coin accepts rpc connections
 * - 'user'    : username of the coin for the rpc interface
 * - 'password': password for the rpc interface of the coin
 **/

function DaemonInterface(daemons, logger) {

    //private members
    const _this = this;
    logger = logger || function (severity, message) {
        console.log(severity + ': ' + message);
    };

    const instances = (function () {
        for (let i = 0; i < daemons.length; i++) {
            daemons[i]['index'] = i;
        }
        return daemons;
    })();

    function init() {
        isOnline(function (online) {
            if (online) {
                _this.emit('online');
            }
        });
    }

    function isOnline(callback) {
        cmd('getinfo', [], function (results) {
            const allOnline = results.every(function (result) {
                return !results.error;
            });
            callback(allOnline);
            if (!allOnline) {
                _this.emit('connectionFailed', results);
            }
        });
    }

    function performHttpRequest(instance, jsonData, callback) {
        const options = {
            hostname: (typeof (instance.host) === 'undefined' ? '127.0.0.1' : instance.host),
            port: instance.port, method: 'POST',
            auth: instance.user + ':' + instance.password,
            headers: { 'Content-Length': jsonData.length }
        };
        const parseJson = function (res, data) {
            let dataJson;
            if (res.statusCode === 401) {
                logger('error', 'Unauthorized RPC access - invalid RPC username or password');
                return;
            }
            try {
                dataJson = JSON.parse(data);
            } catch (e) {
                if (data.indexOf(':-nan') !== -1) {
                    data = data.replace(/:-nan,/g, ":0");
                    parseJson(res, data);
                    return;
                }
                logger('error', 'Could not parse rpc data from daemon instance  ' + instance.index
                    + '\nRequest Data: ' + jsonData + '\nReponse Data: ' + data);
            }
            if (dataJson) {
                callback(dataJson.error, dataJson, data);
            }
        };
        const req = http.request(options, function (res) {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                data += chunk;
            });
            res.on('end', function () {
                parseJson(res, data);
            });
        });
        req.on('error', function (e) {
            if (e.code === 'ECONNREFUSED') {
                callback({ type: 'offline', message: e.message }, null);
            } else {
                callback({ type: 'request error', message: e.message }, null);
            }
        });
        req.end(jsonData);
    }

    //Performs a batch JSON-RPC command - only uses the first configured rpc daemon
    /* First argument must have:
     [
     [ methodName, [params] ],
     [ methodName, [params] ]
     ]
     */
    function batchCmd(cmdArray, callback) {
        const requestJson = [];
        for (let i = 0; i < cmdArray.length; i++) {
            requestJson.push({
                method: cmdArray[i][0], params: cmdArray[i][1],
                id: Date.now() + Math.floor(Math.random() * 10) + i
            });
        }
        const serializedRequest = JSON.stringify(requestJson);
        performHttpRequest(instances[0], serializedRequest, function (error, result) {
            callback(error, result);
        });

    }

    /* Sends a JSON RPC (http://json-rpc.org/wiki/specification) command to every configured daemon.
     The callback function is fired once with the result from each daemon unless streamResults is
     set to true. */
    function cmd(method, params, callback, streamResults, returnRawData) {
        const results = [];
        async.each(instances, function (instance, eachCallback) {
            let itemFinished = function (error, result, data) {
                const returnObj = { error: error, response: (result || {}).result, instance: instance };
                if (returnRawData) {
                    returnObj.data = data;
                }
                if (streamResults) {
                    callback(returnObj);
                } else {
                    results.push(returnObj);
                }
                eachCallback();
                itemFinished = function () {
                };
            };
            const requestJson = JSON.stringify({ method: method, params: params, id: Date.now() + Math.floor(Math.random() * 10) });
            performHttpRequest(instance, requestJson, function (error, result, data) {
                itemFinished(error, result, data);
            });
        }, function () {
            if (!streamResults) {
                callback(results);
            }
        });
    }
    //public members
    this.init = init;
    this.isOnline = isOnline;
    this.cmd = cmd;
    this.batchCmd = batchCmd;
}

DaemonInterface.prototype.__proto__ = events.EventEmitter.prototype;
exports.interface = DaemonInterface;
