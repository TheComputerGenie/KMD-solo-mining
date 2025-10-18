// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const props = require('./properties');

/**
 * Simple Equihash abstraction so other algos can plug similar interface later.
 * Required interface:
 *  - getDiff1(chainKey: string): BigInt diff1 target
 *  - calculateDifficulty(targetHex: string, chainKey: string): number
 *  - shareDiff(headerBigNum: BigInt, chainKey: string): number
 */
class EquihashAlgo {
    constructor(chainKey = 'default') {
        this.chainKey = chainKey in props ? chainKey : 'default';
        // Equihash measures Solutions per second (Sol/s). Ordered units including base.
        this.solutionUnits = [' Sol/s', ' KSol/s', ' MSol/s', ' GSol/s', ' TSol/s', ' PSol/s'];
        // Metadata for display purposes
        this.name = 'Equihash';
        // Variant may differentiate diff1/parameter set without leaking specifics elsewhere
        this.variant = this.chainKey; // e.g., 'default', 'zcash'
    }

    getDiff1() {
        return props[this.chainKey].diff1;
    }

    getMinDiff() {
        return props[this.chainKey].mindiff;
    }

    calculateDifficulty(targetHex) {
        // targetHex already big-endian hex string from daemon (e.g., rpcData.target)
        const targetBigInt = BigInt(`0x${targetHex}`);
        const diff = this.getDiff1() / targetBigInt;
        // Keep precision similar to prior behavior
        return parseFloat(Number(diff).toFixed(9));
    }

    shareDiff(headerBigNum) {
        return Number(this.getDiff1() / headerBigNum);
    }

    formatHashRate(rate) {
        // Scale only when threshold reached; retain base Sol/s if < 1024
        let r = rate;
        let i = 0; // index into solutionUnits
        while (r >= 1024 && i < this.solutionUnits.length - 1) {
            r = r / 1024;
            i++;
        }
        return `${r.toFixed(2)}${this.solutionUnits[i]}`;
    }

    // Original Komodo Equihash network rate formatting from difficulty
    // Returns an object { value, unit, string } where value/unit represent chosen scale.
    formatNetworkRateFromDifficulty(difficulty, blockTimeSeconds = 60) {
        if (typeof difficulty !== 'number' || difficulty <= 0) {
            return { value: 0, unit: 'sol/s', string: '0.00 sol/s' };
        }
        const baseNethash = (difficulty * Math.pow(2, 32)) / blockTimeSeconds; // raw Sol/s
        const msolValue = (baseNethash / Math.pow(10, 15));
        const ksolValue = (baseNethash / Math.pow(10, 12));
        const solValue = (baseNethash / Math.pow(10, 9));
        let value = solValue;
        let unit = 'sol/s';
        if (msolValue > 1) {
            value = msolValue;
            unit = 'Msol/s';
        } else if (ksolValue > 1) {
            value = ksolValue;
            unit = 'ksol/s';
        } else if (solValue > 1) {
            value = solValue;
            unit = 'sol/s';
        } else {
            // Less than 1 sol/s: keep raw base in sol/s scaled (could be <1)
            value = solValue;
            unit = 'sol/s';
        }
        return { value: parseFloat(value.toFixed(2)), unit, string: `${value.toFixed(2)} ${unit}` };
    }

    //block header per https://github.com/zcash/zips/blob/master/protocol/protocol.pdf
    serializeHeader(data) {
        const header = Buffer.alloc(140);
        let position = 0;
        header.writeUInt32LE(data.version, position, 4, 'hex'); position += 4;
        header.write(data.prevHashReversed, position, 32, 'hex'); position += 32;
        header.write(data.merkleRootReversed, position, 32, 'hex'); position += 32;
        header.write(data.hashReserved, position, 32, 'hex'); position += 32;
        header.write(data.nTime, position, 4, 'hex'); position += 4;
        header.write(data.reversedBitsHex, position, 4, 'hex'); position += 4;
        header.write(data.nonce, position, 32, 'hex');
        return header;
    }

    serializeBlock(data) {
        const txCount = data.txCount;
        let varInt;
        if (txCount < 0xfd) {
            varInt = Buffer.from([txCount]);
        } else if (txCount <= 0xffff) {
            varInt = Buffer.alloc(3);
            varInt[0] = 0xfd;
            varInt.writeUInt16LE(txCount, 1);
        } else {
            const hex = txCount.toString(16).padStart(Math.ceil(txCount.toString(16).length / 2) * 2, '0');
            varInt = Buffer.concat([Buffer.from('FD', 'hex'), require('../utxo/util').reverseBuffer(Buffer.from(hex, 'hex'))]);
        }
        const txBuffersLen = data.transactions.length;
        const buffers = new Array(3 + 1 + txBuffersLen);
        buffers[0] = data.header;
        buffers[1] = data.soln;
        buffers[2] = varInt;
        const genTxBuffer = Buffer.from(data.genTx, 'hex');
        buffers[3] = genTxBuffer;
        if (txBuffersLen > 0) {
            for (let i = 0; i < txBuffersLen; i++) {
                buffers[4 + i] = Buffer.from(data.transactions[i].data, 'hex');
            }
        }
        return Buffer.concat(buffers);
    }

    // Create coinbase (generation) transaction; returns {hex, hash}
    createGeneration(opts) {
        // Lazy load UTXO library (variant specific)
        const utxo = require('./utxo');
        const { height, blockReward, feeReward, recipients, poolAddress, coin, pubkey, vouts } = opts;
        const network = utxo.networks[coin.symbol];
        const txb = new utxo.TransactionBuilder(network);
        // Use Sapling version for compatibility
        txb.setVersion(utxo.Transaction.ZCASH_SAPLING_VERSION);

        // Serialize block height per existing logic
        let blockHeightSerial = height.toString(16);
        if (blockHeightSerial.length % 2 === 1) {
            blockHeightSerial = `0${blockHeightSerial}`;
        }
        const heightBytes = Math.ceil((height << 1).toString(2).length / 8);
        const lengthDiff = blockHeightSerial.length / 2 - heightBytes;
        for (let i = 0; i < lengthDiff; i++) {
            blockHeightSerial += '00';
        }
        const lengthHex = `0${heightBytes}`;
        const util = require('../../stratum/util');
        const serializedBlockHeight = Buffer.concat([
            Buffer.from(lengthHex, 'hex'),
            util.reverseBuffer(Buffer.from(blockHeightSerial, 'hex')),
            Buffer.from('00', 'hex') // OP_0
        ]);

        txb.addInput(
            Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex'),
            4294967295,
            4294967295,
            Buffer.concat([serializedBlockHeight, Buffer.from(Buffer.from(height.toString(), 'utf8').toString('hex'), 'hex')])
        );

        // Recreate output logic (simplified: pay all to poolAddress first, then other vouts)
        const poolAddrHash = utxo.address.fromBase58Check(poolAddress).hash;
        const scriptCompile = addrHash => utxo.script.compile([
            utxo.opcodes.OP_DUP,
            utxo.opcodes.OP_HASH160,
            addrHash,
            utxo.opcodes.OP_EQUALVERIFY,
            utxo.opcodes.OP_CHECKSIG
        ]);
        const scriptCompileP2PK = key => utxo.script.compile([
            Buffer.from(key, 'hex'),
            utxo.opcodes.OP_CHECKSIG
        ]);

        for (let i = 0; i < vouts.length; i++) {
            const amt = parseInt(vouts[i].valueZat, 10);
            const sv = vouts[i].scriptPubKey;
            switch (sv.type) {
            case 'pubkey':
                txb.addOutput(scriptCompileP2PK(i === 0 ? pubkey : sv.asm.split(' ', 1)), amt);
                break;
            case 'nulldata':
                txb.addOutput(Buffer.from(sv.hex, 'hex'), amt);
                break;
            case 'pubkeyhash':
                txb.addOutput(scriptCompile(i === 0 ? poolAddrHash : utxo.address.fromBase58Check(sv.addresses[0]).hash), amt);
                break;
            default:
                txb.addOutput(scriptCompile(i === 0 ? poolAddrHash : utxo.address.fromBase58Check(sv.addresses[0]).hash), amt);
            }
        }

        const tx = txb.build();
        return { hex: tx.toHex(), hash: tx.getHash().toString('hex') };
    }

    // Aggregate transaction fees array [{fee: <number|string>, ...}]
    calculateFees(feeTxs) {
        if (!Array.isArray(feeTxs)) {
            return 0;
        }
        let total = 0;
        for (let i = 0; i < feeTxs.length; i++) {
            const f = feeTxs[i] && feeTxs[i].fee;
            if (typeof f === 'number') {
                total += f;
            } else if (typeof f === 'string' && f.trim() !== '' && !isNaN(f)) {
                total += +f;
            }
        }
        return total;
    }
}

module.exports = {
    EquihashAlgo
};
