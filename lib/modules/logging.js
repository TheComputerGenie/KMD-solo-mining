
function severityToColor(severity, text) {
    //console.log('here');
    switch (severity) {
    case 'special':
        return 36;//FgCyan
    case 'debug':
        return 32;//FgGreen
    case 'warning':
        return 33;//FgYellow
    case 'error':
        return 31;//FgRed
    case 'gray':
        return 90;//FgGray
    default:
        console.log("Unknown severity " + severity);
        return 4;//Underscore
    }
}

function timestamp() {
    var date = new Date;
    var timestamp = ("0" + date.getHours()).slice(-2) + ":" +
                    ("0" + date.getMinutes()).slice(-2) + ":" +
                    ("0" + date.getSeconds()).slice(-2) + " " +
                    ("0" + (date.getMonth() + 1)).slice(-2) + "/" +
                    ("0" + date.getDate()).slice(-2);
    return timestamp;
}

module.exports = function (worker, severity, text, forkId) {
    if (!forkId || forkId === '0' || forkId === 'undefined') {
        //console.log(severityToColor(severity))
        console.log('\x1b['+severityToColor(severity)+'m%s\x1b[0m', '[' + timestamp() + '] [' + worker + ']\t' + text);
    } else {
        //console.log(severityToColor(severity, '[' + worker + '][Thread ' + forkId + '][' + timestamp() + '] ' + text))
        console.log('\x1b['+severityToColor(severity)+'m%s\x1b[0m', '[' + timestamp() + '] [Thread ' + forkId + '] [' + worker + ']\t' + text);
    }
}
