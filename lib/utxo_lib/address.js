var bcrypto = require('./crypto')
var bscript = require('./script')
var btemplates = require('./templates')
var networks = require('./networks')
var types = require('./types')

function typeforce(validator, value) {
  if (typeof validator === 'function') {
    // Convert arguments object to array if needed (but not Buffers or other objects with length)
    var testValue = value
    if (value && typeof value === 'object' && typeof value.length === 'number' &&
      !Array.isArray(value) && !Buffer.isBuffer(value) &&
      Object.prototype.toString.call(value) === '[object Arguments]') {
      testValue = Array.prototype.slice.call(value)
    }

    if (!validator(testValue)) {
      throw new TypeError('Expected ' + (validator.name || 'valid type'))
    }
  } else if (Array.isArray(validator)) {
    if (!Array.isArray(value)) {
      throw new TypeError('Expected array')
    }
    for (var i = 0; i < validator.length && i < value.length; i++) {
      typeforce(validator[i], value[i])
    }
  }
  return value
}

// Native Base58Check implementation
var BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
var BASE58_MAP = {}
for (var i = 0; i < BASE58_ALPHABET.length; i++) {
  BASE58_MAP[BASE58_ALPHABET.charAt(i)] = i
}

function base58Encode(buffer) {
  if (buffer.length === 0) return ''

  var digits = [0]
  for (var i = 0; i < buffer.length; i++) {
    var carry = buffer[i]
    for (var j = 0; j < digits.length; j++) {
      carry += digits[j] << 8
      digits[j] = carry % 58
      carry = Math.floor(carry / 58)
    }
    while (carry) {
      digits.push(carry % 58)
      carry = Math.floor(carry / 58)
    }
  }

  // Deal with leading zeros
  for (var k = 0; k < buffer.length && buffer[k] === 0; k++) {
    digits.push(0)
  }

  return digits.reverse().map(function (digit) {
    return BASE58_ALPHABET[digit]
  }).join('')
}

function base58Decode(string) {
  if (string.length === 0) return Buffer.alloc(0)

  var bytes = [0]
  for (var i = 0; i < string.length; i++) {
    var value = BASE58_MAP[string[i]]
    if (value === undefined) throw new Error('Invalid Base58 character: ' + string[i])

    var carry = value
    for (var j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58
      bytes[j] = carry & 0xff
      carry >>= 8
    }
    while (carry) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }

  // Deal with leading ones
  for (var k = 0; k < string.length && string[k] === '1'; k++) {
    bytes.push(0)
  }

  return Buffer.from(bytes.reverse())
}

function base58CheckEncode(payload) {
  var checksum = bcrypto.hash256(payload).slice(0, 4)
  return base58Encode(Buffer.concat([payload, checksum]))
}

function base58CheckDecode(address) {
  var buffer = base58Decode(address)
  if (buffer.length < 4) throw new Error('Invalid Base58Check')

  var payload = buffer.slice(0, -4)
  var checksum = buffer.slice(-4)
  var expectedChecksum = bcrypto.hash256(payload).slice(0, 4)

  if (!checksum.equals(expectedChecksum)) throw new Error('Invalid Base58Check checksum')

  return payload
}

function fromBase58Check(address) {
  var payload = base58CheckDecode(address)

  // TODO: 4.0.0, move to "toOutputScript"
  if (payload.length < 21) throw new TypeError(address + ' is too short')
  if (payload.length > 22) throw new TypeError(address + ' is too long')

  var multibyte = payload.length === 22
  var offset = multibyte ? 2 : 1

  var version = multibyte ? payload.readUInt16BE(0) : payload[0]
  var hash = payload.slice(offset)

  return { version: version, hash: hash }
}



function toBase58Check(hash, version) {
  typeforce(types.tuple(types.Hash160bit, types.UInt16), arguments)

  // Zcash adds an extra prefix resulting in a bigger (22 bytes) payload. We identify them Zcash by checking if the
  // version is multibyte (2 bytes instead of 1)
  var multibyte = version > 0xff
  var size = multibyte ? 22 : 21
  var offset = multibyte ? 2 : 1

  var payload = Buffer.allocUnsafe(size)
  multibyte ? payload.writeUInt16BE(version, 0) : payload.writeUInt8(version, 0)
  hash.copy(payload, offset)

  return base58CheckEncode(payload)
}



function fromOutputScript(outputScript, network) {
  network = network || networks.default

  if (btemplates.pubKeyHash.output.check(outputScript)) return toBase58Check(bscript.compile(outputScript).slice(3, 23), network.pubKeyHash)
  if (btemplates.scriptHash.output.check(outputScript)) return toBase58Check(bscript.compile(outputScript).slice(2, 22), network.scriptHash)

  throw new Error(bscript.toASM(outputScript) + ' has no matching Address')
}

function toOutputScript(address, network) {
  network = network || networks.default

  var decode
  try {
    decode = fromBase58Check(address)
  } catch (e) { }

  if (decode) {
    if (decode.version === network.pubKeyHash) return btemplates.pubKeyHash.output.encode(decode.hash)
    if (decode.version === network.scriptHash) return btemplates.scriptHash.output.encode(decode.hash)
  }

  throw new Error(address + ' has no matching Script')
}

// bs58check compatible functions
function bs58checkDecode(string) {
  var buffer = base58Decode(string)
  if (buffer.length < 4) throw new Error('Invalid Base58Check')

  var payload = buffer.slice(0, -4)
  var checksum = buffer.slice(-4)
  var expectedChecksum = bcrypto.hash256(payload).slice(0, 4)

  if (!checksum.equals(expectedChecksum)) throw new Error('Invalid Base58Check checksum')

  return buffer // Return full buffer including checksum for compatibility
}

function bs58checkEncode(buffer) {
  return base58CheckEncode(buffer)
}

module.exports = {
  fromBase58Check: fromBase58Check,
  fromOutputScript: fromOutputScript,
  toBase58Check: toBase58Check,
  toOutputScript: toOutputScript,
  base58CheckDecode: base58CheckDecode,
  base58CheckEncode: base58CheckEncode,
  bs58checkDecode: bs58checkDecode,
  bs58checkEncode: bs58checkEncode
}
