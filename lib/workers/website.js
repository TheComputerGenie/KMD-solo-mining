const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const Stratum = require('../stratum/index.js')
const daemon = require('../stratum/daemon.js')
const logging = require('../modules/logging.js');

// Simple rate limiter implementation
class RateLimiter {
    constructor(windowMs = 15 * 60 * 1000, max = 100) {
        this.windowMs = windowMs;
        this.max = max;
        this.requests = new Map();
    }

    isAllowed(clientId) {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        if (!this.requests.has(clientId)) {
            this.requests.set(clientId, []);
        }

        const clientRequests = this.requests.get(clientId);

        // Remove old requests outside the window
        const validRequests = clientRequests.filter(time => time > windowStart);
        this.requests.set(clientId, validRequests);

        if (validRequests.length >= this.max) {
            return false;
        }

        validRequests.push(now);
        return true;
    }
}

// Simple DOT template renderer
function renderTemplate(templatePath, data) {
    const template = fs.readFileSync(templatePath, 'utf8');
    let rendered = template;

    // Handle the template syntax used in this project: [[= model.variable]]
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`\\[\\[=\\s*model\\.${key}\\s*\\]\\]`, 'g');
        rendered = rendered.replace(regex, data[key]);
    });

    // Also handle standard DOT syntax: {{=it.key}} just in case
    Object.keys(data).forEach(key => {
        const dotRegex = new RegExp(`{{=it\\.${key}}}`, 'g');
        rendered = rendered.replace(dotRegex, data[key]);
    });

    return rendered;
}

// Get MIME type for file extension
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

// Serve static files
function serveStatic(req, res, filePath) {
    // Validate the file path to prevent directory traversal
    const publicDir = path.join(process.cwd(), 'website/public');
    const resolvedPath = path.resolve(filePath);
    const resolvedPublicDir = path.resolve(publicDir);

    // Ensure the resolved path is within the public directory
    if (!resolvedPath.startsWith(resolvedPublicDir)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }

        const mimeType = getMimeType(filePath);
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

module.exports = function () {
    var config = JSON.parse(process.env.config);
    var websiteConfig = config.website;
    var limiter = new RateLimiter(15 * 60 * 1000, 100); // 15 minutes, 100 requests

    daemon.interface(config.daemons, function (severity, message) {
        logging('Website', severity, message);
    });

    const server = http.createServer((req, res) => {
        const parsedUrl = url.parse(req.url, true);
        const pathname = parsedUrl.pathname;
        const clientId = req.connection.remoteAddress || req.socket.remoteAddress;

        // Apply rate limiting
        if (!limiter.isAllowed(clientId)) {
            res.writeHead(429, { 'Content-Type': 'text/plain' });
            res.end('Too Many Requests');
            return;
        }

        // Set common security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Only handle GET requests for this simple server
        if (req.method !== 'GET') {
            res.writeHead(405, { 'Content-Type': 'text/plain' });
            res.end('Method Not Allowed');
            return;
        }

        // Route handling
        if (pathname === '/') {
            // Convert daemon.cmd to Promise for easier async handling
            const daemonCmd = (command, params) => {
                return new Promise((resolve) => {
                    daemon.cmd(command, params, (result) => {
                        resolve(result);
                    });
                });
            };

            // Handle the home page with async/await
            (async () => {
                try {
                    let blocks, difficulty, hashrate;

                    // Get daemon info
                    const infoResult = await daemonCmd('getinfo', []);
                    if (infoResult && infoResult[0] && infoResult[0].response) {
                        blocks = infoResult[0].response.blocks;
                        difficulty = infoResult[0].response.difficulty;
                    } else {
                        blocks = 'N/A';
                        difficulty = 'N/A';
                    }

                    // Get network hashrate
                    const networkResult = await daemonCmd('getnetworksolps', []);
                    if (networkResult && networkResult[0] && networkResult[0].response) {
                        hashrate = networkResult[0].response;
                    } else {
                        hashrate = 'N/A';
                    }

                    // Render template
                    const templatePath = path.join(process.cwd(), 'website/public/index.dot');
                    const html = renderTemplate(templatePath, {
                        blocks: blocks,
                        difficulty: difficulty,
                        hashrate: hashrate,
                        coinName: config.coin.name,
                        coinSymbol: config.coin.symbol
                    });
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(html);
                } catch (error) {
                    logging('Website', 'error', 'Page rendering error: ' + error.message);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                }
            })();
        } else if (pathname === '/api') {
            try {
                const templatePath = path.join(process.cwd(), 'website/public/api.dot');
                const html = renderTemplate(templatePath, {
                    coinName: config.coin.name,
                    coinSymbol: config.coin.symbol
                });
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(html);
            } catch (error) {
                logging('Website', 'error', 'Template rendering error: ' + error.message);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Internal Server Error');
            }
        } else if (pathname === '/blocks.json') {
            const blocksPath = path.join(process.cwd(), 'block_logs', `${config.coin.symbol}_blocks.json`);
            fs.readFile(blocksPath, (err, data) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('File not found');
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(data);
            });
        } else if (pathname === '/coin-info') {
            // Serve coin information including symbol for frontend use
            try {
                const coinInfo = {
                    symbol: config.coin.symbol,
                    name: config.coin.name
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(coinInfo));
            } catch (error) {
                logging('Website', 'error', 'Coin info error: ' + error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Unable to get coin info' }));
            }
        } else {
            // Try to serve static files
            // Sanitize pathname to prevent directory traversal
            const safePath = pathname.replace(/\.\./g, '').replace(/\/+/g, '/');
            const staticPath = path.join(process.cwd(), 'website/public', safePath);

            fs.access(staticPath, fs.constants.F_OK, (err) => {
                if (err) {
                    res.writeHead(404, { 'Content-Type': 'text/plain' });
                    res.end('Not Found');
                } else {
                    serveStatic(req, res, staticPath);
                }
            });
        }
    });

    server.listen(websiteConfig.port, websiteConfig.host, () => {
        logging("Website", "debug", `Server listening at http://${websiteConfig.host}:${websiteConfig.port}`);
    });
}
