/**
 * Bitcoin-style merkle root generation
 * 
 * This file is derived from merkle-bitcoin v1.0.2
 * Original work Copyright (c) Jorge Zaccaro <jorgezaccaro@gmail.com>
 * Original repository: https://github.com/jorgezaccaro/merkle-bitcoin
 * 
 * Modified for KMD-solo-mining to:
 * - Remove dependency on async v1.2.1 (replaced with native array methods)
 * - Support both synchronous and asynchronous operation modes
 * - Use modern JavaScript features (const/let, arrow functions)
 * - Fixed deprecated Buffer constructor usage
 * 
 * Changes made:
 * - Replaced async.map with native Array.map()
 * - Added synchronous mode (returns result directly when no callback provided)
 * - Updated Buffer.from() usage instead of deprecated Buffer constructor
 * - Maintained full API compatibility with original merkle-bitcoin
 */

'use strict';

module.exports = generate;

const crypto = require('crypto');

/*--------------------------------------------------------------------------------*/

/** Generates a merkle root from an array of hash leaves
 * @param {object} array - The array of hash leaves
 * @param {object} [options]
   * @param {boolean} [options.reverse=true] - Indicates the leaves and root hashes should be reversed (endianness)
 * @param {function} [callback] - Optional callback for async operation
 * @returns {object} - If no callback provided, returns merkle object synchronously
 */
function generate(array, options, callback) {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    options = options || {};

    try {
        /* Return if there is only one hash */
        if (array.length === 1) {
            const result = { root: array[0] };
            if (callback) {
                return callback(null, result);
            }
            return result;
        }

        /* Check if the hashes should be reversed for proper endianness */
        if (options.reverse === false) {
            const result = recursiveMerkle(array);
            if (callback) {
                return callback(null, result);
            }
            return result;
        } else {
            const reversedHashes = reverseHashes(array);
            const merkle = iterativeMerkle(reversedHashes);
            merkle.root = merkle.root.match(/.{2}/g).reverse().join('');
            if (callback) {
                return callback(null, merkle);
            }
            return merkle;
        }
    } catch (err) {
        if (callback) {
            return callback(err);
        }
        throw err;
    }
}

/** Iteratively computes the root of a merkle tree
 * @param {object} hashes - An array of hash leaves
 * @returns {object} merkleTree - The computed merkle tree
 */
function iterativeMerkle(hashes) {
    let currentHashes = [...hashes]; // copy to avoid mutating input

    while (currentHashes.length > 1) {
        const concatHashes = [];

        /* Duplicate last element if the array length is odd */
        if (currentHashes.length % 2 === 1) {
            currentHashes.push(currentHashes[currentHashes.length - 1]);
        }

        /* Concatenate hashes and push them to a new array */
        for (let i = 0, length = currentHashes.length; i < length; i += 2) {
            concatHashes.push(currentHashes[i] + currentHashes[i + 1]);
        }

        /* Map every element of the new array with a hash function */
        currentHashes = concatHashes.map(data => doubleHash(data));
    }

    return { root: currentHashes[0] || '  ' };
}

/*--------------------------------------------------------------------------------*/

/** Reverses the bytes of each element of an array of hashes
 * @param {object} hashes - The array of hashes whose elements must be reversed
 * @returns {array} reversedHashes - The array with reversed hash elements
 */
function reverseHashes(hashes) {
    return hashes.map(element => element.match(/.{2}/g).reverse().join(''));
}

/** Hashes the input data twice
 * @param {string} data - The data to be double hashed
 * @param {string} [algorithm=sha256] - The hashing algorithm to be used
 * @returns {string} hash2 - The double hash of the input data
 */
function doubleHash(data, algorithm) {
    algorithm = algorithm || 'sha256';
    const hash1 = crypto.createHash(algorithm).update(Buffer.from(data, 'hex')).digest();
    const hash2 = crypto.createHash(algorithm).update(hash1).digest('hex');
    return hash2;
}