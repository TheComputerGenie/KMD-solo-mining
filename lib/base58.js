/*!
 * Base58 and Base58Check encoding
 * 
 * Originally from base58-native package
 * https://github.com/gasteve/node-base58
 * 
 * Copyright 2013 BitPay, Inc.
 * Copyright (c) 2011 Stefan Thomas <justmoon@members.fsf.org>
 * Native extensions are Copyright (c) 2011 Andrew Schaaf <andrew@andrewschaaf.com>
 * Parts of this software are based on BitcoinJ
 * Copyright (c) 2011 Google Inc.
 * 
 * Author: Satoshi Nakamoto <satoshin@gmx.com>
 * Contributors:
 *   - Stefan Thomas <moon@justmoon.net>
 *   - Andrew Schaaf <andrew@andrewschaaf.com>
 *   - Jeff Garzik <jgarzik@bitpay.com>
 *   - Stephen Pair <stephen@bitpay.com>
 */

var crypto = require('crypto');

// BigInt utility functions for Base58
function bufferToBigInt(buffer) {
    if (!buffer || buffer.length === 0) return 0n;
    let result = 0n;
    for (let i = 0; i < buffer.length; i++) {
        result = (result << 8n) + BigInt(buffer[i]);
    }
    return result;
}

function bigIntToBuffer(bigint) {
    if (bigint === 0n) return Buffer.alloc(1);
    let hex = bigint.toString(16);
    if (hex.length % 2) hex = '0' + hex;
    return Buffer.from(hex, 'hex');
}

var globalBuffer = Buffer.alloc(1024);
var zerobuf = Buffer.alloc(0);
var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
var ALPHABET_ZERO = ALPHABET[0];
var ALPHABET_BUF = Buffer.from(ALPHABET, 'ascii');
var ALPHABET_INV = {};
for (var i = 0; i < ALPHABET.length; i++) {
    ALPHABET_INV[ALPHABET[i]] = i;
};

// Vanilla Base58 Encoding
var base58 = {
    encode: function (buf) {
        var str;
        var x = bufferToBigInt(buf);
        var r;

        if (buf.length < 512) {
            str = globalBuffer;
        } else {
            str = Buffer.alloc(buf.length << 1);
        }
        var i = str.length - 1;
        while (x > 0n) {
            r = x % 58n;
            x = x / 58n;
            str[i] = ALPHABET_BUF[Number(r)];
            i--;
        }

        // deal with leading zeros
        var j = 0;
        while (buf[j] == 0) {
            str[i] = ALPHABET_BUF[0];
            j++; i--;
        }

        return str.slice(i + 1, str.length).toString('ascii');
    },

    decode: function (str) {
        if (str.length == 0) return zerobuf;
        var answer = 0n;
        for (var i = 0; i < str.length; i++) {
            answer = answer * 58n;
            answer = answer + BigInt(ALPHABET_INV[str[i]]);
        };
        var i = 0;
        while (i < str.length && str[i] == ALPHABET_ZERO) {
            i++;
        }
        if (i > 0) {
            var zb = Buffer.alloc(i);
            zb.fill(0);
            if (i == str.length) return zb;
            answer = bigIntToBuffer(answer);
            return Buffer.concat([zb, answer], i + answer.length);
        } else {
            return bigIntToBuffer(answer);
        }
    },
};

// Base58Check Encoding
function sha256(data) {
    return Buffer.from(crypto.createHash('sha256').update(data).digest('binary'), 'binary');
};

function doubleSHA256(data) {
    return sha256(sha256(data));
};

var base58Check = {
    encode: function (buf) {
        var checkedBuf = Buffer.alloc(buf.length + 4);
        var hash = doubleSHA256(buf);
        buf.copy(checkedBuf);
        hash.copy(checkedBuf, buf.length);
        return base58.encode(checkedBuf);
    },

    decode: function (s) {
        var buf = base58.decode(s);
        if (buf.length < 4) {
            throw new Error("invalid input: too short");
        }

        var data = buf.slice(0, -4);
        var csum = buf.slice(-4);

        var hash = doubleSHA256(data);
        var hash4 = hash.slice(0, 4);

        if (csum.toString() != hash4.toString()) {
            throw new Error("checksum mismatch");
        }

        return data;
    },
};

// if you frequently do base58 encodings with data larger
// than 512 bytes, you can use this method to expand the
// size of the reusable buffer
exports.setBuffer = function (buf) {
    globalBuffer = buf;
};

exports.base58 = base58;
exports.base58Check = base58Check;
exports.encode = base58.encode;
exports.decode = base58.decode;