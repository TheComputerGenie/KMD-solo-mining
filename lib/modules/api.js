const fs = require('fs');
const logging = require('./logging.js')

module.exports = function (method, obj) {
    var forkId = process.env.forkId;
    if (method === "block") {
        fs.readFile('./logs/blocks.json', 'utf8', updateBlocksJSON);
        function updateBlocksJSON(err, data) {
            if (err) { err.code === "ENOENT" ? createBlocksJSON(obj) : logging('Api', 'error', err, forkId); }
            try {
                var object = JSON.parse(data)
                object.push(obj)
                fs.writeFile('./logs/blocks.json', JSON.stringify(object), done)
            } catch (err) {
                /* We ignore the catch because 99% of the time it's realated to readFileAfterClose
                    because blocks come faster than write, close, reopen -shitty "fix" but "works" */
            }
        }
        function createBlocksJSON(data) { fs.writeFile("./logs/blocks.json", JSON.stringify(array), done) }
        function done(err) { if (err) console.log(err) }
    }
}
