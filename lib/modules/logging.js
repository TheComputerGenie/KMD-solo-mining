// ANSI color codes for terminal output
const colors = {
    cyan: '\x1b[36m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    italic: '\x1b[3m',
    reset: '\x1b[0m'
};

function severityToColor(severity, text) {
    let colorCode;
    switch (severity) {
    case 'special':
        colorCode = colors.cyan;
        break;
    case 'debug':
        colorCode = colors.green;
        break;
    case 'warning':
        colorCode = colors.yellow;
        break;
    case 'error':
        colorCode = colors.red;
        break;
    default:
        console.log("Unknown severity " + severity);
        colorCode = colors.italic;
        break;
    }
    return colorCode + text + colors.reset;
}

function timestamp() {
    const date = new Date;
    const timestamp = ("0" + (date.getMonth() + 1)).slice(-2) + "/" +
        ("0" + date.getDate()).slice(-2) + " " +
        ("0" + date.getHours()).slice(-2) + ":" +
        ("0" + date.getMinutes()).slice(-2) + ":" +
        ("0" + date.getSeconds()).slice(-2);
    return timestamp;
}

module.exports = function (worker, severity, text, forkId) {
    if (forkId == null) {
        console.log(severityToColor(severity, '[' + worker + '][' + timestamp() + '] ' + text))
    } else {
        console.log(severityToColor(severity, '[' + worker + '][Thread ' + forkId + '][' + timestamp() + '] ' + text))
    }
}
