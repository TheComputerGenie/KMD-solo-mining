# KMD Solo Mining Code Style Guide

This document outlines the coding standards and conventions for the KMD Solo Mining project. Following these guidelines ensures consistency across the codebase and makes it easier for new developers to contribute.

## Table of Contents
1. [Variable Declarations](#variable-declarations)
2. [Strings](#strings)
3. [Indentation](#indentation)
4. [Braces](#braces)
5. [Semicolons](#semicolons)
6. [Comments](#comments)
7. [Naming Conventions](#naming-conventions)
8. [Spacing](#spacing)
9. [Functions](#functions)
10. [File Structure](#file-structure)
11. [ESLint](#eslint)

## Variable Declarations

### Use `const` for constants and imports
```javascript
const http = require('http');
const DEFAULT_PORT = 17117;
```

### Use `let` for variables that change
```javascript
let counter = 0;
let result = calculateSomething();
```

### Avoid `var` (legacy)
```javascript
// ❌ Don't do this
var oldStyle = 'deprecated';

// ✅ Do this instead
let modernStyle = 'preferred';
```

## Strings

Use single quotes for simple string literals:
```javascript
// ✅ Correct
const message = 'Hello world';

// ❌ Avoid
const message = "Hello world";
```

### Template Literals

Use template literals for string interpolation or for strings that span multiple lines. This is preferred over string concatenation.

```javascript
// ✅ Correct and preferred
const coinJson = `${coinSymbol}.json`;
const path = `coin_configs/${coinJson}`;

const multiLine = `
  This is a string
  that spans multiple
  lines.
`;

// ❌ Avoid concatenation
const path = 'coin_configs/' + coinSymbol + '.json';
```

## Indentation

Use 4 spaces for indentation (no tabs):
```javascript
function example() {
    if (condition) {
        console.log('Indented with 4 spaces');
        for (let i = 0; i < items.length; i++) {
            processItem(items[i]);
        }
    }
}
```

## Braces

Use One True Brace Style (1TBS) - opening brace on the same line:
```javascript
// ✅ Correct
if (condition) {
    doSomething();
} else {
    doSomethingElse();
}

function myFunction() {
    // code here
}

// ❌ Avoid
if (condition)
{
    doSomething();
}
```

**Always use braces** for control structures, even single statements:
```javascript
// ✅ Correct
if (error) {
    return;
}

// ❌ Avoid
if (error)
    return;
```

## Semicolons

Use semicolons to terminate statements:
```javascript
const x = 5;
console.log(x);

function foo() {
    return 'bar';
}
```

## Comments

### Single-line comments
```javascript
// This is a single-line comment
const result = calculate(); // Inline comment
```

### Multi-line comments
```javascript
/*
 * This is a multi-line comment
 * that spans several lines
 */
```

### JSDoc for functions
```javascript
/**
 * Description of what the function does
 * @param {string} param1 - Description of parameter
 * @returns {Object} Description of return value
 */
function documentedFunction(param1) {
    // implementation
}
```

### TODO comments
```javascript
// TODO: Refactor this function for better performance
// FIXME: This needs to be fixed before release
```

## Naming Conventions

### Variables and functions: camelCase
```javascript
let userName = 'john';
let isValid = true;

function processData() {
    // implementation
}
```

### Constants: UPPER_SNAKE_CASE
```javascript
const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT = 5000;
```

### Classes/Constructors: PascalCase
```javascript
function DaemonInterface(daemons, logger) {
    // implementation
}
```

### Private members: Leading underscore
```javascript
class MyClass {
    constructor() {
        this._privateField = 'value';
    }
}
```

## Spacing

### Operators
Always add spaces around operators:
```javascript
// ✅ Correct
let sum = a + b;
let result = x > y ? x : y;
let arr = [1, 2, 3];

// ❌ Avoid
let sum=a+b;
let result = x>y?x:y;
let arr=[1,2,3];
```

### Function calls and declarations
```javascript
// ✅ Correct
function myFunction(param1, param2) {
    // implementation
}

myFunction(arg1, arg2);

// ❌ Avoid
function myFunction(param1,param2){
    // implementation
}

myFunction(arg1,arg2);
```

### Object literals
```javascript
// ✅ Correct
const obj = {
    key1: 'value1',
    key2: 'value2'
};

// ❌ Avoid
const obj = {
    key1:'value1',
    key2:'value2'
};
```

## Functions

### Function declarations
Prefer `function` declarations for named functions:
```javascript
function processData(data) {
    // implementation
}
```

### Arrow functions
Use arrow functions for anonymous functions and callbacks:
```javascript
const items = [1, 2, 3];
const doubled = items.map(item => item * 2);

setTimeout(() => {
    console.log('Done');
}, 1000);
```

### Default parameters
Use default parameters instead of checking for undefined:
```javascript
// ✅ Correct
function connect(host = 'localhost', port = 8080) {
    // implementation
}

// ❌ Avoid
function connect(host, port) {
    host = host || 'localhost';
    port = port || 8080;
    // implementation
}
```

## File Structure

### File naming
- Use lowercase with hyphens for multi-word names: `block-template.js`
- Use `.js` extension for all JavaScript files

docs/                 # Documentation
### Directory structure
```
lib/                        # Core library code
├── algos/                  # Algorithm abstractions (Equihash etc.)
│   └── equihash/           # Equihash implementation + variant properties
│       ├── index.js        # EquihashAlgo class (difficulty, shareDiff, hashrate, createGeneration)
│       ├── properties.js   # diff1 / mindiff per variant (komodo, zcash)
│       └── utxo/           # UTXO tx/signature logic for Equihash-family chains
├── stratum/                # Stratum protocol implementation (algo-agnostic)
├── workers/                # Worker processes
└── modules/                # Shared modules

scripts/                    # CLI scripts
website/                    # Web interface
├── public/                 # Static web assets
docs/                       # Documentation
```

### Algorithm-Specific UTXO Library
The former top-level `utxo_lib/` directory has been relocated to `lib/algos/equihash/utxo/` so all Equihash (Komodo/Zcash-style) transaction serialization, Overwinter/Sapling handling, and signature hashing lives under the algorithm boundary. Core code now builds the coinbase via `algo.createGeneration()` instead of importing a global `transactions.js` helper. This ensures no algorithm-specific logic leaks into generic Stratum / pool management layers.

To add a new algorithm with unique transaction rules, mirror this structure under `algos/<newalgo>/` and expose a matching method on the algorithm class.

## Code Quality

### Error handling
Always handle errors appropriately:
```javascript
try {
    riskyOperation();
} catch (error) {
    logger('error', 'Operation failed: ' + error.message);
}
```

### Logging
Use the centralized logging module:
```javascript
const logging = require('../modules/logging.js');
logging('info', 'Server started on port ' + port);
```

### Validation
Validate inputs and handle edge cases:
```javascript
function processUser(user) {
    if (!user || typeof user !== 'object') {
        throw new Error('Invalid user object');
    }
    // process user
}
```

## Tools

### ESLint Configuration
The project uses ESLint to enforce coding standards and maintain code quality. **Note: ESLint is not included in the default dependencies to keep production installs minimal. Developers must install ESLint manually for linting.**

To install ESLint for development:
```bash
npm install --save-dev eslint
```

ESLint is configured with a custom `eslint.config.mjs` file that includes the following key rules:

#### Core Rules
- **`brace-style`**: Enforces One True Brace Style (1TBS) - opening braces on the same line
- **`curly`**: Requires braces for all control statements (no single-line if statements)
- **`indent`**: Enforces 4-space indentation
- **`quotes`**: Single quotes preferred for strings
- **`no-var`**: Prohibits `var` declarations (use `const` or `let`)
- **`prefer-const`**: Requires `const` for variables that are never reassigned
- **`semi`**: Requires semicolons to terminate statements

#### Running ESLint

**Check all files:**
```bash
npx eslint "**/*.js"
```

**Check specific files:**
```bash
npx eslint lib/stratum/transactions.js
```

**Auto-fix issues (where possible):**
```bash
npx eslint "**/*.js" --fix
```

**Check only source files (excluding minified third-party libraries):**
```bash
npx eslint "lib/**/*.js" "scripts/**/*.js" "init.js" "website/public/main.js"
```

#### ESLint in Development Workflow

1. **Install ESLint**: Run `npm install --save-dev eslint` to set up linting tools
2. **Before committing**: Always run ESLint to ensure code follows standards
3. **Auto-fixing**: Use `--fix` to automatically correct formatting issues
4. **Manual fixes**: Some issues (like variable declarations) require manual fixes
5. **CI/CD**: ESLint runs automatically in the build pipeline

#### Common ESLint Errors and Fixes

**Variable declaration errors:**
```javascript
// ❌ Error: Unexpected var, use let or const instead
var oldStyle = 'bad';

// ✅ Fix: Use const for constants
const newStyle = 'good';

// ✅ Fix: Use let for variables that change
let counter = 0;
```

**Brace style errors:**
```javascript
// ❌ Error: Opening brace on new line
if (condition)
{
    doSomething();
}

// ✅ Fix: Opening brace on same line
if (condition) {
    doSomething();
}
```

**Missing braces:**
```javascript
// ❌ Error: Expected { after 'if' condition
if (error)
    return;

// ✅ Fix: Always use braces
if (error) {
    return;
}
```

#### ESLint Configuration File
The `.eslintr.config.mjs` file contains all the rules and can be extended as needed. When adding new rules, ensure they align with the project's style guide and update this documentation.

## Contributing

When contributing code:
1. **Install ESLint**: Run `npm install --save-dev eslint` for code linting
2. **Follow this style guide** - Read and adhere to all standards outlined above
3. **Run ESLint before committing** - Use `npx eslint "**/*.js" --fix` to check and auto-fix issues
4. **Fix any remaining ESLint errors manually** - Some issues require manual intervention
5. **Write meaningful commit messages** - Include what changed and why
6. **Add tests for new functionality** - Ensure code is well-tested
7. **Update documentation as needed** - Keep docs current with code changes

**Pre-commit checklist:**
- [ ] ESLint installed: `npm install --save-dev eslint`
- [ ] Code follows style guide standards
- [ ] ESLint passes with no errors: `npx eslint "lib/**/*.js" "scripts/**/*.js" "init.js"`
- [ ] Tests pass (if applicable)
- [ ] Documentation updated

## Examples

### Complete function example
```javascript
/**
 * Processes a block template and returns formatted data
 * @param {Object} template - The raw block template
 * @param {string} coin - Coin symbol
 * @returns {Object} Processed block data
 */
function processBlockTemplate(template, coin = 'KMD') {
    if (!template || typeof template !== 'object') {
        throw new Error('Invalid block template');
    }

    const processed = {
        version: template.version,
        previousBlockHash: template.previousblockhash,
        timestamp: template.curtime,
        difficulty: template.difficulty
    };

    // Additional processing logic
    if (coin === 'KMD') {
        processed.komodoSpecific = true;
    }

    return processed;
}
```

### Class-like structure example
```javascript
function PoolWorker() {
    const _this = this;
    let isRunning = false;

    this.start = function() {
        if (isRunning) {
            return;
        }

        isRunning = true;
        // Start worker logic
    };

    this.stop = function() {
        isRunning = false;
        // Stop worker logic
    };
}
```</content>
<parameter name="filePath">/home/computergenie/KMD-solo-mining/docs/style-guide.md