const crypto = require('crypto');

function createHash(algorithm) {
    return (buffer) => crypto.createHash(algorithm).update(buffer).digest();
}

const ripemd160 = createHash('ripemd160');
const sha1 = createHash('sha1');
const sha256 = createHash('sha256');

function hash160(buffer) {
    return ripemd160(sha256(buffer));
}

function hash256(buffer) {
    return sha256(sha256(buffer));
}

module.exports = {
    hash160,
    hash256,
    ripemd160,
    sha1,
    sha256
};
