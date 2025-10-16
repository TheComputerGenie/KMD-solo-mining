'use strict';

const crypto = require('crypto');

function sha256d(buffer) {
    return crypto.createHash('sha256').update(crypto.createHash('sha256').update(buffer).digest()).digest();
}

function reverse(buffer) {
    const reversed = Buffer.alloc(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        reversed[i] = buffer[buffer.length - 1 - i];
    }
    return reversed;
}

function generate(array, options) {
    options = options || {};
    const reverseHashes = options.reverse !== false;

    if (array.length === 1) {
        return { root: array[0] };
    }

    let hashes = array.map(h => Buffer.from(h, 'hex'));

    if (reverseHashes) {
        hashes = hashes.map(reverse);
    }

    while (hashes.length > 1) {
        const newHashes = [];
        for (let i = 0; i < hashes.length; i += 2) {
            const a = hashes[i];
            const b = (i + 1 < hashes.length) ? hashes[i + 1] : a;
            const combined = Buffer.concat([a, b]);
            const hash = sha256d(combined);
            newHashes.push(hash);
        }
        hashes = newHashes;
    }

    let root = hashes[0];
    if (reverseHashes) {
        root = reverse(root);
    }

    return { root: root.toString('hex') };
}

module.exports = generate;