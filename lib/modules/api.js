const fs = require('fs').promises;
const logging = require('./logging.js');

// Simple in-memory lock to prevent race conditions
let isWriting = false;
const writeQueue = [];

module.exports = function (method, obj, coinSymbol) {
    const forkId = process.env.forkId;
    if (method === 'block') {
        // Add to queue if currently writing, otherwise process immediately
        if (isWriting) {
            writeQueue.push({ obj, coinSymbol });
            return;
        }

        processBlockRecord(obj, coinSymbol, forkId);
    }
};

async function processBlockRecord(obj, coinSymbol, forkId) {
    isWriting = true;

    try {
        const blocksFilePath = `./block_logs/${coinSymbol}_blocks.json`;
        // Use asynchronous read to avoid blocking
        let data;
        try {
            data = await fs.readFile(blocksFilePath, 'utf8');
        } catch (err) {
            if (err.code === 'ENOENT') {
                // File doesn't exist, create it
                const array = [obj];
                await fs.writeFile(blocksFilePath, JSON.stringify(array));
                logging('Api', 'debug', `Block ${  obj.block  } recorded. Hash: ${  obj.hash.substring(0, 16)  }... Finder: ${  obj.finder}`, forkId);
                finishWrite();
                return;
            } else {
                logging('Api', 'error', `Error reading ${  blocksFilePath  }: ${  err.message}`, forkId);
                finishWrite();
                return;
            }
        }

        const object = JSON.parse(data);

        // Check for duplicate block heights
        const existingBlock = object.find((block) => {
            return block.block === obj.block;
        });

        if (existingBlock) {
            if (existingBlock.hash === obj.hash) {
                logging('Api', 'debug', `Identical block already recorded at height ${  obj.block  }. Hash: ${  obj.hash}`, forkId);
            } else {
                logging('Api', 'warning', `Duplicate block height ${  obj.block  } prevented. New hash: ${  obj.hash.substring(0, 16)  }... (keeping existing: ${  existingBlock.hash.substring(0, 16)  }...)`, forkId);
            }
            finishWrite();
            return; // Don't add duplicate
        }

        // Add new block and write asynchronously
        object.push(obj);
        await fs.writeFile(blocksFilePath, JSON.stringify(object));
        logging('Api', 'debug', `Block ${  obj.block  } recorded. Hash: ${  obj.hash.substring(0, 16)  }... Finder: ${  obj.finder}`, forkId);

    } catch (err) {
        logging('Api', 'warning', `Error updating blocks.json: ${  err.message}`, forkId);
    }

    finishWrite();
}

function finishWrite() {
    isWriting = false;

    // Process next item in queue if any
    if (writeQueue.length > 0) {
        const nextItem = writeQueue.shift();
        const forkId = process.env.forkId;
        processBlockRecord(nextItem.obj, nextItem.coinSymbol, forkId);
    }
}
