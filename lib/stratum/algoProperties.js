// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const util = require('./util.js');

const algos = module.exports = global.algos = {
    'komodo': {
        diff1: parseInt('0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f'), //The highest possible target
        mindiff: parseInt('0x200f0f0f')
    },
    'zcash': {
        diff1: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        mindiff: parseInt('0x00ffffff')
    }
};
