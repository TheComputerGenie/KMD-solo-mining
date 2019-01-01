const fs = require('fs');
const path = require('path');
const async = require('async');
const express = require('express');
const engine = require('express-dot-engine');
const Stratum = require('../stratum/index.js')
const daemon = require('../stratum/daemon.js')
const logging = require('../modules/logging.js');

module.exports = function () {
    var config = JSON.parse(process.env.config);
    var websiteConfig = config.website;
    var app = express();
    app.engine('dot', engine.__express);
    app.set('views', path.join(process.cwd() + '/website/public'));
    app.set('view engine', 'dot');
    app.use(express.static(process.cwd() + '/website/public'));
    app.get('/', function (req, res) {
        var blocks;
        var difficulty;
        var hashrate;
        daemon.interface(config.daemons, function (severity, message) {
            logging('Website', severity, message);
        });
        //var daemon = new Stratum.daemon.interface([config.daemons], function(severity, message) {
        async.series([
            function (callback) {
                daemon.cmd('getinfo', [], function (result) {
                    blocks = result[0].response.blocks;
                    difficulty = result[0].response.difficulty
                    callback(null)
                })
            },
            function (callback) {
                daemon.cmd('getnetworksolps', [], function (result) {
                    hashrate = result[0].response;
                    callback(null)
                })
            },
            function (callback) {
                res.render('index', {
                    blocks: blocks,
                    difficulty: difficulty,
                    hashrate: hashrate
                });
            }
        ])
    })
    app.get('/api', function (req, res) { res.render('api', {}); })
    app.get('/blocks.json', function (req, res) { res.sendFile(process.cwd() + '/logs/blocks.json'); })
    var server = app.listen(websiteConfig.port, function () {
        var host = websiteConfig.host
        var port = server.address().port
        logging("Website", "debug", "Example app listening at http://" + host + ":" + port);
    })
}
