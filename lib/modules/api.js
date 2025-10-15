const fs = require('fs');
const logging = require('./logging.js')

// Simple in-memory lock to prevent race conditions
let isWriting = false;
let writeQueue = [];

module.exports = function (method, obj) {
    var forkId = process.env.forkId;
    if (method === "block") {
        // Add to queue if currently writing, otherwise process immediately
        if (isWriting) {
            writeQueue.push(obj);
            return;
        }

        processBlockRecord(obj, forkId);
    }
}

function processBlockRecord(obj, forkId) {
    isWriting = true;

    try {
        // Use synchronous read to avoid race conditions
        let data;
        try {
            data = fs.readFileSync('./logs/blocks.json', 'utf8');
        } catch (err) {
            if (err.code === "ENOENT") {
                // File doesn't exist, create it
                const array = [obj];
                fs.writeFileSync('./logs/blocks.json', JSON.stringify(array));
                logging('Api', 'debug', 'Block ' + obj.block + ' recorded. Hash: ' + obj.hash.substring(0, 16) + '... Finder: ' + obj.finder, forkId);
                finishWrite();
                return;
            } else {
                logging('Api', 'error', 'Error reading blocks.json: ' + err.message, forkId);
                finishWrite();
                return;
            }
        }

        let object = JSON.parse(data);

        // Check for duplicate block heights
        const existingBlock = object.find(function (block) {
            return block.block === obj.block;
        });

        if (existingBlock) {
            if (existingBlock.hash === obj.hash) {
                logging('Api', 'debug', 'Identical block already recorded at height ' + obj.block + '. Hash: ' + obj.hash, forkId);
            } else {
                logging('Api', 'warning', 'Duplicate block height ' + obj.block + ' prevented. New hash: ' + obj.hash.substring(0, 16) + '... (keeping existing: ' + existingBlock.hash.substring(0, 16) + '...)', forkId);
            }
            finishWrite();
            return; // Don't add duplicate
        }

        // Add new block and write synchronously
        object.push(obj);
        fs.writeFileSync('./logs/blocks.json', JSON.stringify(object));
        logging('Api', 'debug', 'Block ' + obj.block + ' recorded. Hash: ' + obj.hash.substring(0, 16) + '... Finder: ' + obj.finder, forkId);

    } catch (err) {
        logging('Api', 'warning', 'Error updating blocks.json: ' + err.message, forkId);
    }

    finishWrite();
}

function finishWrite() {
    isWriting = false;

    // Process next item in queue if any
    if (writeQueue.length > 0) {
        const nextObj = writeQueue.shift();
        const forkId = process.env.forkId;
        processBlockRecord(nextObj, forkId);
    }
}
