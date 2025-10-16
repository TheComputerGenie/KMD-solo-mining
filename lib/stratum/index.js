const net = require('net');
const events = require('events');

//Gives us global access to everything we need for each hashing algorithm
require('./algoProperties.js');
const pool = require('./pool.js');
exports.daemon = require('./daemon.js');
exports.createPool = function (poolOptions, authorizeFn) {
    const newPool = new pool(poolOptions, authorizeFn);
    return newPool;
};
