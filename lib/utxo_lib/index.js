const script = require('./script')

const templates = require('./templates')
for (const key in templates) {
    script[key] = templates[key]
}

module.exports = {
    bufferutils: require('./bufferutils'), // TODO: remove in 4.0.0

    Transaction: require('./transaction'),
    TransactionBuilder: require('./transaction_builder'),

    address: require('./address'),
    coins: require('./coins'),
    crypto: require('./crypto'),
    networks: require('./networks'),
    opcodes: require('./opcodes'),
    script: script
}
