// Coins supported by bitgo-bitcoinjs-lib
const typeforce = require('./typeforce')

const coins = {
  DEFAULT: 'default',
  KMD: 'kmd'
}

coins.isZcash = function (network) {
  return !!network.isZcash
}

coins.isKomodo = function (network) {
  return typeforce.value(coins.KMD)(network.coin)
}

coins.isValidCoin = typeforce.oneOf(
  coins.isZcash,
  coins.isKomodo
)

module.exports = coins
