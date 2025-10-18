## Solomining pool for Komodo. (READY FOR TESTING)

## The solo miner's solo pool
The objective is a "light-weight" pool that does what needs to be done.
This pool will **not** work for MCL (due to alternating blocks using CCs), if I do make a pool for it that pool will be on its own.

Auto-Lowering Port Difficulty & VarDiff Capping
-------------
Solo mining can experience periods where the current block (network) difficulty temporarily drops below the static per-port difficulty you configured. Previously, that meant miners on higher-diff ports had to wait until difficulty rose again to submit a valid block. The pool now includes an adaptive mechanism to keep you mining efficiently:

What it does:
* Detects when the current block difficulty is lower than a port's base difficulty.
* Automatically lowers the miner's assigned difficulty to the block difficulty for that port (without changing your original config values).
* Caps VarDiff retargets so they cannot rise above the lowered effective difficulty while the block difficulty remains lower than the port's base setting.
* Restores normal behavior as soon as block difficulty exceeds the port's configured difficulty again.

Example log output:
```
[Stratum]  Network diff of 115.40137753 is lower than port 5334 w/ diff 140 and port 5335 w/ diff 840 -- auto-lowering enabled; miners will use network diff until it exceeds port base diff.
[Stratum]  Initial auto-lowered miner difficulty for ports: 5334 (140 -> 115.40137753), 5335 (840 -> 115.40137753)
[VarDiff]  VarDiff Retarget for MinerX to 115.40137753
```

Benefits:
* Lets high-difficulty ports submit valid blocks during low network difficulty windows.
* Prevents VarDiff from overshooting and hiding discoverable blocks.
* Requires no manual intervention—automatically reverts when conditions change.

## When all else fails: RTFM!

Requirements
------------
* node v21.4+ (installs by following "Install" below)
* coin daemon 

Install (Ubuntu)
-------------
These instructions will guide you through installing the necessary software to run the solo mining pool.

```shell
# Update your package list
sudo apt-get update

# Install Node.js v21.x
curl -fsSL https://deb.nodesource.com/setup_21.x | sudo -E bash -
sudo apt-get install -y nodejs

# Download the solo mining pool software
git clone https://github.com/TheComputerGenie/KMD-solo-mining
cd KMD-solo-mining

# Install the required node packages
npm install
```

Configure
-------------
The configuration system has been updated to support multiple coins. There are now two types of config files:

1. **System-wide config** (`system-config.json`): Contains settings that are not coin-dependent (logging, website, clustering, etc.)
2. **Coin-specific config** (`coin_configs/{COIN}.json`): Contains coin-specific settings (address, ports, daemons, etc.)

Currently supported coins: KMD, KOIN

To add a new coin, create a new JSON file in the `coin_configs/` directory with the coin's configuration.

Recommended port difficulties:
GPU: 300
Minis: 3000
Large ASICs: 30000
Rentals: 1350000

Run
------------
```bash
# Start with default coin (KMD)
npm start

# Start with specific coin
npm start KMD
npm start KOIN
```

Update (normally)
------------- 
```bash
git pull
```

Update (including any module changes )
------------- 
```bash
git pull
rm -rf node_modules
npm install
```

Differences between this and Z-NOMP
------------
* This is meant for solo mining.
* There is no share system.
* No payments (coins go directly to the address in config).
* NO equihashverify - While this pool will work with rentals (NiceHash checked at the time of initial publishing), it is intended
for the true solo miner, who needs no such protection against fake shares.

Notes and known issues:
------------
* (N) There is no TLS functionality, because I'm not sure I could ever be convinced of need for a solo setup.

License
-------
Released under the GNU General Public License 3
http://www.gnu.org/licenses/gpl-3.0.html

_Forked from [aayanl/equihash-solomining](https://github.com/aayanl/equihash-solomining) which is licensed under GNU GPL v2_

## Algorithm Abstraction

This pool now separates algorithm-specific logic under `lib/algos/`. The initial implementation provides an Equihash abstraction (`lib/algos/equihash`) exposing:

* `getDiff1()` – returns the base diff1 target for the chain variant (e.g. Komodo vs Zcash style)
* `calculateDifficulty(targetHex)` – converts block template target into pool difficulty number
* `shareDiff(headerBigNum)` – computes share difficulty from a solved header

The Stratum stack injects an algorithm instance (`options.algorithm`) rather than relying on global state. Future algorithms can add a sibling directory (e.g. `lib/algos/verushash`) implementing the same interface and set `options.algorithm` accordingly when the pool starts.

Legacy global `algos` usage was removed (`lib/stratum/algoProperties.js`). Target calculations and share difficulty now route through the abstraction. This makes it easier to support Komodo ecosystem runtime forks using different PoW schemes.

### Hashrate Terminology
Different proof-of-work algorithms label throughput differently. Equihash counts solutions per second (Sol/s) rather than raw hashes. The abstraction provides `formatHashRate()` so UI and logs display the correct unit (e.g., KSol/s). If additional algos are added (e.g., SHA256d), their implementation should supply appropriate units such as KH/s, MH/s, etc. The default algorithm variant matches Komodo parameters and is referenced internally as `default` to avoid hard-coding chain names.

### UTXO / Transaction Logic Isolation
All Equihash (Komodo/Zcash-style) UTXO transaction building, serialization and network param logic has been relocated under `lib/algos/equihash/utxo/`. The core pool now invokes `algo.createGeneration({...})` to build the coinbase transaction instead of referencing a global `transactions.js`. This enforces the rule: "no algorithm-specific code outside the algorithm directory".

To add a new algorithm with custom transaction rules, implement a similar `createGeneration()` method on the algorithm class and keep any chain-specific UTXO helpers under its directory.
