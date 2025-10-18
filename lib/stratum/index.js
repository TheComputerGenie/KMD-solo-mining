// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const net = require('net');
const events = require('events');

// Algorithm specifics now handled via `lib/algos/*` abstractions initialized in pool
const pool = require('./pool.js');
exports.daemon = require('./daemon.js');
exports.createPool = function (poolOptions, authorizeFn) {
    const newPool = new pool(poolOptions, authorizeFn);
    return newPool;
};
