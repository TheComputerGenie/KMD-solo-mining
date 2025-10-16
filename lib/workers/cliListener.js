const events = require('events');
const net = require('net');
const listener = module.exports = function listener(port) {
    const _this = this;
    const emitLog = function (text) {
        _this.emit('log', text); 
    };
    this.start = function () {
        net.createServer((c) => {
            let data = '';
            try {
                c.on('data', (d) => {
                    data += d;
                    if (data.slice(-1) === '\n') {
                        const message = JSON.parse(data);
                        _this.emit('command', message.command, message.params, message.options, (message) => {
                            c.end(message);
                        });
                    }
                });
                c.on('end', () => { });
                c.on('error', () => { });
            } catch (e) {
                emitLog(`CLI listener failed to parse message ${  data}`);
            }

        }).listen(port, '127.0.0.1', () => {
            emitLog(`CLI listening on port ${  port}`);
        });
    };
};
listener.prototype.__proto__ = events.EventEmitter.prototype;
