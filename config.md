config.json
```javascript
{
    "coin": "KMD.json",                              // the file in 'coins' folder that defines current used coin
    "address": "RQf6QUVqtcv6D63Tf8njZDphNG9f9tfyHm",    // the transparent address you want reward to go to
    "daemons": [                    // any number of access allowed daemons -- for most users this will only be 1 local daemon
        {
            "host": "127.0.0.1",    // IP address -- 127.0.0.1 is the same PC as pool
            "port": 45453,          // open port -- can be found with `getinfo` call
            "user": "MyUser",       // rpcuser set in the ./komodo/COIN/coin.conf file
            "password": "MyPass"    // rpcpassword set in the ./komodo/COIN/coin.conf file
        }                           // ends with }, if more than one; ends with } if last/only one
    ],
    "p2p": {
        "enabled": true,                // true for connecting to daemon as peer -- recomended
        "host": "127.0.0.1",            // IP address -- 127.0.0.1 is the same PC as pool -- generally same as daemon
        "port": 45452,                  // open port -- can be found with `getinfo` call
        "disableTransactions": false    // allow peers to relay transactions -- set "true" unless you know why "false"
    },
    "ports": {          // This is where you set ports and difficulty levels for miners to connect
        "3850": {       // Port to open for miners
            "diff": 2   // difficulty for that port -- 1 Difficulty is actually 8192, 0.125 Difficulty is actually 1024 
        },              // ends with }, if more than one
        "3851": {
            "diff": 10
        }               // ends with } if last/only one
    },
    "website": {
        "enabled": true,
        "host": "0.0.0.0",
        "port": "8088"
    },
    "blockRefreshInterval": 5,          // how many seconds apart to ask daemon for block info -- 0 (disable) is fine if P2P enabled
    "jobRebroadcastTimeout": 70,        // how many seconds apart to ask daemon for newest tx info and give miners new work
    "connectionTimeout": 6000000,       // how man ms to allow a miner to go without sending something before disconnecting them
    "tcpProxyProtocol": false,          // set false -- while this may be usable in solo, I'm not sure all of the code is intact
    "clustering": {                     // pool attempts load self-balancing through multi-threading
        "enabled": false,               // If you have a lot of miners that connect individually, set true otherwise 1 is plenty
        "forks": 3                      // how many distinct threads you want open
    },
    "cliPort": 17117,                   // what port to open for blocknotify -- must be set even if you don't use blocknotify
    "blockNotifyListener": {
        "enabled": false,               // leave false -- meaningless and not even coded for left in to make a point
        "port": 17118                   // that no one has audited this code/config since 2014
    }
}
```

PIRATE.json
```javascript
{
    "name": "Pirate",           // The name of the coin
    "symbol": "ARRR",           // The coin's ticker symbol
    "peerMagic": "58e0b617",    // easiest way to find this is run daemon -- magic.17b6e058 becomes 58e0b617
    "txfee": 0.0001             // min tx fee -- almost always 0.0001 for Komodo and assetchains -- meaningless for solo
}
```
