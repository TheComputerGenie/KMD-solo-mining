// Central algorithm loader abstraction
// External code should call loadAlgorithm(symbolOrName) and receive an object implementing:
//  - getDiff1()
//  - getMinDiff()
//  - calculateDifficulty(targetHex)
//  - shareDiff(headerBigNum)
//  - formatHashRate(rate)
// Mapping logic stays here; rest of codebase remains algorithm-agnostic.

const { EquihashAlgo } = require('./komodo');

function loadAlgorithm(name) {
    const key = (name || '').toLowerCase();
    switch (key) {
    case 'zcash':
        return new EquihashAlgo('zcash');
    case 'komodo':
    case 'default':
    default:
        // Fallback (and explicit 'default') both map to Komodo variant
        return new EquihashAlgo('komodo');
    }
}

module.exports = { loadAlgorithm };
