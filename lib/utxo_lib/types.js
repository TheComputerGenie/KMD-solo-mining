// Native type checking functions
function isNumber(value) {
    return typeof value === 'number' && !isNaN(value)
}

function isString(value) {
    return typeof value === 'string'
}

function isBuffer(value) {
    return Buffer.isBuffer(value)
}

function isArray(value) {
    return Array.isArray(value)
}

function isFunction(value) {
    return typeof value === 'function'
}

function isBoolean(value) {
    return typeof value === 'boolean'
}

function isObject(value) {
    return value != null && typeof value === 'object' && !Array.isArray(value)
}

function UInt8(value) {
    return isNumber(value) && value >= 0 && value <= 255 && Math.floor(value) === value
}

function UInt16(value) {
    return isNumber(value) && value >= 0 && value <= 65535 && Math.floor(value) === value
}

function UInt32(value) {
    return isNumber(value) && value >= 0 && value <= 4294967295 && Math.floor(value) === value
}

function UInt53(value) {
    return isNumber(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER && Math.floor(value) === value
}

const UINT31_MAX = Math.pow(2, 31) - 1
function UInt31(value) {
    return UInt32(value) && value <= UINT31_MAX
}

function BIP32Path(value) {
    return isString(value) && value.match(/^(m\/)?(\d+'?\/)*\d+'?$/)
}
BIP32Path.toJSON = function () {
    return 'BIP32 derivation path' 
}

const SATOSHI_MAX = 21 * 1e14
function Satoshi(value) {
    return UInt53(value) && value <= SATOSHI_MAX
}

function BufferN(length) {
    return function (value) {
        return isBuffer(value) && value.length === length
    }
}

// external dependent types
const BigIntType = function (value) {
    return typeof value === 'bigint' 
}
const ECPoint = function (value) {
    return value && typeof value === 'object' &&
    typeof value.x !== 'undefined' && typeof value.y !== 'undefined'
}

// exposed, external API
function ECSignature(value) {
    return isObject(value) && BigIntType(value.r) && BigIntType(value.s)
}

function networkVersion(value) {
    return UInt8(value) || UInt16(value)
}

function Network(value) {
    return isObject(value) &&
    (isBuffer(value.messagePrefix) || isString(value.messagePrefix)) &&
    isObject(value.bip32) &&
    UInt32(value.bip32.public) &&
    UInt32(value.bip32.private) &&
    networkVersion(value.pubKeyHash) &&
    networkVersion(value.scriptHash) &&
    UInt8(value.wif)
}

// Native type validation functions
function tuple(...types) {
    return function (values) {
        if (!isArray(values) || values.length !== types.length) {
            return false
        }
        return values.every((value, index) => types[index](value))
    }
}

function oneOf(...types) {
    return function (value) {
        return types.some(type => type(value))
    }
}

function maybe(type) {
    return function (value) {
        return value === undefined || value === null || type(value)
    }
}

function compile(spec) {
    if (typeof spec === 'function') {
        return spec
    }
    if (typeof spec === 'object') {
        return function (value) {
            if (!isObject(value)) {
                return false
            }
            return Object.keys(spec).every(key => {
                const validator = compile(spec[key])
                return validator(value[key])
            })
        }
    }
    return function () {
        return true 
    }
}

// Export all type checking functions
const types = {
    // Native JS types
    Array: isArray,
    Boolean: isBoolean,
    Buffer: isBuffer,
    Function: isFunction,
    Number: isNumber,
    Object: isObject,
    String: isString,

    // Numeric types
    UInt8: UInt8,
    UInt16: UInt16,
    UInt31: UInt31,
    UInt32: UInt32,
    UInt53: UInt53,

    // Custom types
    BigInt: BigIntType,
    BIP32Path: BIP32Path,
    Buffer256bit: BufferN(32),
    ECPoint: ECPoint,
    ECSignature: ECSignature,
    Hash160bit: BufferN(20),
    Hash256bit: BufferN(32),
    Network: Network,
    NetworkVersion: networkVersion,
    Satoshi: Satoshi,

    // Utility functions
    BufferN: BufferN,
    compile: compile,
    maybe: maybe,
    oneOf: oneOf,
    tuple: tuple,

    // Additional types
    Hex: function (value) {
        return isString(value) && /^[0-9a-fA-F]*$/.test(value) && value.length % 2 === 0
    },
    Null: function (value) {
        return value == null
    }
}

module.exports = types
