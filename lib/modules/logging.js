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
        console.log(`Unknown severity ${  severity}`);
        colorCode = colors.italic;
        break;
    }
    return colorCode + text + colors.reset;
}

function timestamp() {
    const d = new Date();
    const mm = d.getMonth() + 1;
    const DD = d.getDate();
    const hh = d.getHours();
    const mi = d.getMinutes();
    const ss = d.getSeconds();
    // pad via conditional ternary is marginally faster than slice on small strings
    const pad = n => n < 10 ? `0${  n}` : `${  n}`;
    return `${pad(mm)}/${pad(DD)} ${pad(hh)}:${pad(mi)}:${pad(ss)}`;
}

module.exports = function (worker, severity, text, forkId) {
    if (forkId == null) {
        console.log(severityToColor(severity, `[${  worker  }][${  timestamp()  }] ${  text}`));
    } else {
        console.log(severityToColor(severity, `[${  worker  }][Thread ${  forkId  }][${  timestamp()  }] ${  text}`));
    }
};
