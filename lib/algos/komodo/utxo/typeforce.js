// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

// Native typeforce implementation
// Replaces typeforce dependency

const types = require('./types');

function typeforce(validator, value, allowIncomplete) {
    if (typeof validator === 'function') {
        // Convert arguments object to array if needed (but not Buffers or other objects with length)
        let testValue = value;
        if (value && typeof value === 'object' && typeof value.length === 'number' &&
            !Array.isArray(value) && !Buffer.isBuffer(value) &&
            Object.prototype.toString.call(value) === '[object Arguments]') {
            testValue = Array.prototype.slice.call(value);
        }

        if (!validator(testValue)) {
            throw new TypeError(`Expected ${validator.name || 'valid type'}`);
        }
    } else if (typeof validator === 'object' && !Array.isArray(validator)) {
        if (typeof value !== 'object' || value === null) {
            throw new TypeError('Expected object');
        }
        for (const key in validator) {
            if (allowIncomplete && value[key] === undefined) {
                continue;
            }
            typeforce(validator[key], value[key], allowIncomplete);
        }
    } else if (Array.isArray(validator)) {
        if (!Array.isArray(value)) {
            throw new TypeError('Expected array');
        }
        // For argument validation, we validate each argument against corresponding validator
        for (let i = 0; i < validator.length && i < value.length; i++) {
            if (allowIncomplete && value[i] === undefined) {
                continue;
            }
            typeforce(validator[i], value[i], allowIncomplete);
        }
    }
    return value;
}

// Helper functions from typeforce library
typeforce.anyOf = function () {
    const validators = Array.prototype.slice.call(arguments);
    return function (value) {
        return validators.some((validator) => {
            try {
                typeforce(validator, value);
                return true;
            } catch (e) {
                return false;
            }
        });
    };
};

typeforce.allOf = function () {
    const validators = Array.prototype.slice.call(arguments);
    return function (value) {
        return validators.every((validator) => {
            try {
                typeforce(validator, value);
                return true;
            } catch (e) {
                return false;
            }
        });
    };
};

typeforce.oneOf = function () {
    const values = Array.prototype.slice.call(arguments);
    return function (value) {
        return values.indexOf(value) !== -1;
    };
};

typeforce.maybe = function (validator) {
    return function (value) {
        return value === undefined || value === null || typeforce.quacksLike(validator)(value);
    };
};

typeforce.arrayOf = function (validator) {
    return function (array) {
        if (!Array.isArray(array)) {
            return false;
        }
        return array.every((item) => {
            try {
                typeforce(validator, item);
                return true;
            } catch (e) {
                return false;
            }
        });
    };
};

typeforce.quacksLike = function (validator) {
    return function (value) {
        try {
            typeforce(validator, value);
            return true;
        } catch (e) {
            return false;
        }
    };
};

typeforce.tuple = function () {
    const validators = Array.prototype.slice.call(arguments);
    return function (values) {
        if (!Array.isArray(values)) {
            return false;
        }
        if (values.length !== validators.length) {
            return false;
        }
        return values.every((value, index) => {
            try {
                typeforce(validators[index], value);
                return true;
            } catch (e) {
                return false;
            }
        });
    };
};

// Export the main function and helpers
module.exports = typeforce;
module.exports.anyOf = typeforce.anyOf;
module.exports.allOf = typeforce.allOf;
module.exports.oneOf = typeforce.oneOf;
module.exports.maybe = typeforce.maybe;
module.exports.arrayOf = typeforce.arrayOf;
module.exports.quacksLike = typeforce.quacksLike;