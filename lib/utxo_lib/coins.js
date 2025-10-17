// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const typeforce = require('./typeforce');

const coins = {
    DEFAULT: 'default',
    KMD: 'kmd'
};

coins.isZcash = function (network) {
    return !!network.isZcash;
};

coins.isKomodo = function (network) {
    return typeforce.value(coins.KMD)(network.coin);
};

coins.isValidCoin = typeforce.oneOf(
    coins.isZcash,
    coins.isKomodo
);

module.exports = coins;
