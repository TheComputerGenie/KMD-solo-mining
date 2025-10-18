// Generic algorithm loader: isolates selection logic from base stratum code.
// No algorithm-specific code should appear outside algos/ directory.
// Expected config shape: { coin: { algorithm: 'komodo' | <other> }, ... }
// Fallback: throws if algo module not found to force explicit configuration.

function getAlgoInstance(config) {
    const algoName = (config && config.coin && config.coin.algorithm) || process.env.ALGORITHM;
    if (!algoName) {
        throw new Error('Algorithm not specified (config.coin.algorithm or ALGORITHM env)');
    }
    // Resolve module path under algos/<name>/index.js expected to export a class or factory
    let mod;
    try {
        mod = require(`./${algoName}`);
    } catch (e) {
        throw new Error(`Algorithm module './${algoName}' could not be loaded: ${e.message}`);
    }

    // Common pattern: module exports { EquihashAlgo } or { default }
    const Ctor = mod.default || mod[Object.keys(mod).find(k => /Algo$/.test(k))];
    if (!Ctor) {
        throw new Error(`No algorithm class exported by './${algoName}'. Expected a class ending with 'Algo'.`);
    }
    return new Ctor();
}

module.exports = { getAlgoInstance };
