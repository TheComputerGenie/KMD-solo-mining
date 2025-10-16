# Configuration Files

The configuration system has been updated to support multiple coins with a clean separation between system-wide and coin-specific settings.

## system-config.json - System-wide Settings

This file contains settings that apply to all coins and the mining pool system itself.

```javascript
{
    "printShares": false,               // log individual shares submitted by miners
    "minDiffAdjust": true,              // automatically adjust minimum difficulty
    "printSubmissions": true,           // log block submission attempts
    "jobRebroadcastTimeout": 55,        // seconds between job rebroadcasts
    "connectionTimeout": 6000000,       // ms to wait before disconnecting idle miners
    "emitInvalidBlockHashes": false,    // whether to emit invalid block hashes
    "ports": {                          // miner connection ports (shared across all coins)
        "5332": {                       // port number for miners to connect
            "diff": 1,                  // base difficulty for this port
            "varDiff": {                // variable difficulty settings
                "minDiff": 1,           // minimum difficulty
                "maxDiff": 1000000,     // maximum difficulty
                "targetTime": 5,        // target time per share in seconds
                "retargetTime": 90,     // how often to adjust difficulty
                "variancePercent": 10   // allowed variance percentage
            }
        },
        "5333": {                       // additional ports...
            "diff": 10,
            "varDiff": {
                "minDiff": 1,
                "maxDiff": 1000000,
                "targetTime": 5,
                "retargetTime": 90,
                "variancePercent": 10
            }
        }
    },
    "website": {
        "enabled": true,                // enable/disable web interface
        "host": "0.0.0.0",              // web server bind address
        "port": "8088"                  // web server port
    },
    "cliPort": 17117,                   // port for CLI commands
    "clustering": {                     // multi-threading settings
        "enabled": false,               // enable multi-threading
        "forks": 3                      // number of worker threads
    },
    "blockNotifyListener": {
        "enabled": false,               // block notification listener
        "port": 17118                   // block notify port
    },
    "blockRefreshInterval": 0          // how many seconds apart to ask daemon for block info (0 = disabled, use P2P)
}
```

## coin_configs/{COIN}.json - Coin-specific Settings

Each coin has its own configuration file in the `coin_configs/` directory. These contain settings specific to that coin.

### KMD.json (Komodo)
```javascript
{
    "name": "Komodo",                   // display name of the coin
    "symbol": "KMD",                    // coin ticker symbol
    "peerMagic": "f9eee48d",            // network magic bytes
    "txfee": 0.0001,                   // minimum transaction fee
    "address": "RESWsMfWFvPGGUPGfGgXPgGKWeqVaAtUfy",  // mining reward address
    "pubkey": "02592809a25cd27cca40ea6ccb04a40a79b3108d3991761412f12db9773f336078", // pubkey for mining rewards
    "daemons": [                        // daemon connection settings
        {
            "host": "127.0.0.1",        // daemon IP address
            "port": 7771,               // daemon RPC port
            "user": "MyUser",           // RPC username
            "password": "MyPass"        // RPC password
        }
    ],
    "p2p": {                            // P2P network settings
        "enabled": true,                // enable P2P connection to daemon
        "host": "127.0.0.1",            // P2P host
        "port": 7770,                   // P2P port
        "disableTransactions": false    // allow transaction relay
    }
}
```

## Adding a New Coin

To add support for a new coin:

1. Create a new JSON file in the `coin_configs/` directory (e.g., `NEWCOIN.json`)
2. Fill in the coin-specific settings (name, symbol, peerMagic, address, pubkey, daemons, p2p)
3. Start the pool with: `npm start NEWCOIN`

The system will automatically use the shared ports and settings from `system-config.json` while loading the coin-specific configuration from `coin_configs/NEWCOIN.json`.

## Port Difficulty Recommendations

Recommended difficulty settings for different hardware types:
- **GPU**: 300
- **Minis**: 3000
- **Large ASICs**: 30000
- **Rentals**: 1350000
