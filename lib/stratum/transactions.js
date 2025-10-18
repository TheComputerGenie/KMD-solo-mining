// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// DEPRECATED: This file used to hold algorithm-specific coinbase & fee logic.
// It now ONLY delegates to the selected algorithm implementation via the loader.
// No algorithm-specific code or fallbacks must live here.
const { getAlgoInstance } = require('../algos/loader');

let lastHash = null;

// Compatibility: retain txHash accessor for callers that still query it.
exports.txHash = function () {
    return lastHash;
};

// Wrapper matching old signature: returns coinbase tx hex.
// Internally calls algo.createGeneration which returns {hex, hash}.
exports.createGeneration = function (blockHeight, blockReward, feeReward, recipients, poolAddress, coin, pubkey, vouts) {
    // Obtain config from env (same source other layers use). Fallback to object with coin.
    let config;
    try {
        config = JSON.parse(process.env.config || '{}'); 
    } catch {
        config = {}; 
    }
    if (!config.coin && coin) {
        config.coin = coin;
    }
    const algo = getAlgoInstance(config);
    const result = algo.createGeneration({
        height: blockHeight,
        blockReward,
        feeReward,
        recipients,
        poolAddress,
        coin: coin || (config.coin || {}),
        pubkey,
        vouts: vouts || []
    });
    lastHash = result.hash;
    return result.hex;
};

// Wrapper to algorithm fee aggregation.
module.exports.getFees = function (feeArray) {
    let config;
    try {
        config = JSON.parse(process.env.config || '{}'); 
    } catch {
        config = {}; 
    }
    const algo = getAlgoInstance(config);
    return algo.calculateFees(feeArray);
};
