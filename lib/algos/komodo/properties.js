// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// Equihash specific constants; diff1 values differ per chain family variant sometimes.
// Provide named variants so future algos can extend likewise.
module.exports = {
    // Default variant = Komodo (Equihash 200,9 parameters, different diff1 from Zcash)
    default: {
        diff1: BigInt('0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f'),
        mindiff: BigInt('0x200f0f0f')
    },
    komodo: {
        diff1: BigInt('0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f'),
        mindiff: BigInt('0x200f0f0f')
    },
    // Zcash style (also Equihash 200,9) with distinct diff1 target
    zcash: {
        diff1: BigInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
        mindiff: BigInt('0x00ffffff')
    }
};
