// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html
// Initially ported from stratum-mining share-limiter
// https://github.com/ahmedbodi/stratum-mining/blob/master/mining/basic_share_limiter.py

const events = require('events');

class RingBuffer {
    constructor(maxSize) {
        this.maxSize = maxSize;
        this.data = [];
        this.cursor = 0;
        this.isFull = false;
    }

    append(x) {
        if (this.isFull) {
            this.data[this.cursor] = x;
            this.cursor = (this.cursor + 1) % this.maxSize;
        } else {
            this.data.push(x);
            this.cursor++;
            if (this.data.length === this.maxSize) {
                this.cursor = 0;
                this.isFull = true;
            }
        }
    }

    avg() {
        if (this.data.length === 0) {
            return 0;
        }
        const sum = this.data.reduce((a, b) => a + b, 0);
        return sum / this.data.length;
    }

    size() {
        return this.data.length;
    }

    clear() {
        this.data = [];
        this.cursor = 0;
        this.isFull = false;
    }
}

// Truncate a number to a fixed amount of decimal places
function toFixed(num, len) {
    return parseFloat(num.toFixed(len));
}

const varDiff = module.exports = class extends events.EventEmitter {
    constructor(port, varDiffOptions) {
        super();
        const variance = varDiffOptions.targetTime * (varDiffOptions.variancePercent / 100);
        const bufferSize = varDiffOptions.retargetTime / varDiffOptions.targetTime * 4;
        const tMin = varDiffOptions.targetTime - variance;
        const tMax = varDiffOptions.targetTime + variance;

        this.manageClient = function (client) {
            const stratumPort = client.socket.localPort;

            if (stratumPort != port) {
                console.error('Handling a client which is not of this vardiff?');
            }
            const options = varDiffOptions;

            let lastTs;
            let lastRtc;
            let timeBuffer;

            client.on('submit', () => {
                const ts = Math.floor(Date.now() / 1000);

                if (!lastRtc) {
                    lastRtc = ts - options.retargetTime / 2;
                    lastTs = ts;
                    timeBuffer = new RingBuffer(bufferSize);
                    return;
                }

                const sinceLast = ts - lastTs;

                timeBuffer.append(sinceLast);
                lastTs = ts;

                if ((ts - lastRtc) < options.retargetTime && timeBuffer.size() > 0) {
                    return;
                }

                lastRtc = ts;
                const avg = timeBuffer.avg();
                if (avg === 0) {
                    return;
                } // Avoid division by zero

                let ddiff = options.targetTime / avg;

                if (avg > tMax && client.difficulty > options.minDiff) {
                    if (options.x2mode) {
                        ddiff = 0.5;
                    }
                    if (ddiff * client.difficulty < options.minDiff) {
                        ddiff = options.minDiff / client.difficulty;
                    }
                } else if (avg < tMin) {
                    if (options.x2mode) {
                        ddiff = 2;
                    }
                    const diffMax = options.maxDiff;
                    if (ddiff * client.difficulty > diffMax) {
                        ddiff = diffMax / client.difficulty;
                    }
                } else {
                    return;
                }

                const newDiff = toFixed(client.difficulty * ddiff, 8);
                timeBuffer.clear();
                this.emit('newDifficulty', client, newDiff);
            });
        };
    }
};
