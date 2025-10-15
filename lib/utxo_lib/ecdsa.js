var crypto = require('crypto')
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

var ZERO = Buffer.alloc(1, 0)
var ONE = Buffer.alloc(1, 1)

var ecurve = require('ecurve')
var secp256k1 = ecurve.getCurveByName('secp256k1')

// BigInteger compatibility for ecurve
function BigInteger(value) {
  if (typeof value === 'string') {
    return ecurve.BigInteger(value)
  }
  return ecurve.BigInteger(value.toString())
}

// https://tools.ietf.org/html/rfc6979#section-3.2
function deterministicGenerateK(hash, x, checkSig) {
  typeforce(types.tuple(
    types.Hash256bit,
    types.Buffer256bit,
    types.Function
  ), arguments)

  // Step A, ignored as hash already provided
  // Step B
  // Step C
  var k = Buffer.alloc(32, 0)
  var v = Buffer.alloc(32, 1)

  // Step D
  k = crypto.createHmac('sha256', k)
    .update(v)
    .update(ZERO)
    .update(x)
    .update(hash)
    .digest()

  // Step E
  v = crypto.createHmac('sha256', k).update(v).digest()

  // Step F
  k = crypto.createHmac('sha256', k)
    .update(v)
    .update(ONE)
    .update(x)
    .update(hash)
    .digest()

  // Step G
  v = crypto.createHmac('sha256', k).update(v).digest()

  // Step H1/H2a, ignored as tlen === qlen (256 bit)
  // Step H2b
  v = crypto.createHmac('sha256', k).update(v).digest()

  var T = bigIntFromBuffer(v)

  // Step H3, repeat until T is within the interval [1, n - 1] and is suitable for ECDSA
  while (bigIntSignum(T) <= 0 || bigIntCompareTo(T, n) >= 0 || !checkSig(T)) {
    k = crypto.createHmac('sha256', k)
      .update(v)
      .update(ZERO)
      .digest()

    v = crypto.createHmac('sha256', k).update(v).digest()

    // Step H1/H2a, again, ignored as tlen === qlen (256 bit)
    // Step H2b again
    v = crypto.createHmac('sha256', k).update(v).digest()
    T = bigIntFromBuffer(v)
  }

  return T
}

// Helper functions for BigInt
function bigIntFromBuffer(buf) {
  return global.BigInt('0x' + buf.toString('hex'))
}

function bigIntToBuffer(bigInt, size) {
  let hex = bigInt.toString(16)
  if (hex.length % 2) hex = '0' + hex
  let buf = Buffer.from(hex, 'hex')
  if (buf.length < size) {
    buf = Buffer.concat([Buffer.alloc(size - buf.length), buf])
  } else if (buf.length > size) {
    buf = buf.slice(-size)
  }
  return buf
}

function bigIntSignum(bigInt) {
  return bigInt < global.BigInt(0) ? -1 : bigInt > global.BigInt(0) ? 1 : 0
}

function bigIntCompareTo(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

function modInverse(a, m) {
  let m0 = m
  let y = global.BigInt(0)
  let x = global.BigInt(1)
  if (m === global.BigInt(1)) return global.BigInt(0)
  while (a > global.BigInt(1)) {
    let q = a / m
    let t = m
    m = a % m
    a = t
    t = y
    y = x - q * y
    x = t
  }
  if (x < global.BigInt(0)) x += m0
  return x
}

var n = global.BigInt(secp256k1.n.toString())
var N_OVER_TWO = n >> global.BigInt(1)

function sign(hash, d) {
  typeforce(types.tuple(types.Hash256bit, types.BigInt), arguments)

  var x = bigIntToBuffer(d, 32)
  var e = bigIntFromBuffer(hash)
  var G = secp256k1.G

  var r, s
  deterministicGenerateK(hash, x, function (k) {
    var Q = G.multiply(BigInteger(k.toString()))

    if (secp256k1.isInfinity(Q)) return false

    r = global.BigInt(Q.affineX.toString()) % n
    if (r === global.BigInt(0)) return false

    s = (modInverse(k, n) * (e + d * r)) % n
    if (s === global.BigInt(0)) return false

    return true
  })

  // enforce low S values, see bip62: 'low s values in signatures'
  if (s > N_OVER_TWO) {
    s = n - s
  }

  return new ECSignature(r, s)
}

function verify(hash, signature, Q) {
  typeforce(types.tuple(
    types.Hash256bit,
    types.ECSignature,
    types.ECPoint
  ), arguments)

  var G = secp256k1.G

  var r = signature.r
  var s = signature.s

  // 1.4.1 Enforce r and s are both integers in the interval [1, n − 1]
  if (r <= global.BigInt(0) || r >= n) return false
  if (s <= global.BigInt(0) || s >= n) return false

  // 1.4.2 H = Hash(M), already done by the user
  // 1.4.3 e = H
  var e = bigIntFromBuffer(hash)

  // Compute s^-1
  var sInv = modInverse(s, n)

  // 1.4.4 Compute u1 = es^−1 mod n
  //               u2 = rs^−1 mod n
  var u1 = (e * sInv) % n
  var u2 = (r * sInv) % n

  // 1.4.5 Compute R = (xR, yR)
  //               R = u1G + u2Q
  var R = G.multiplyTwo(BigInteger(u1.toString()), Q, BigInteger(u2.toString()))

  // 1.4.5 (cont.) Enforce R is not at infinity
  if (secp256k1.isInfinity(R)) return false

  // 1.4.6 Convert the field element R.x to an integer
  var xR = R.affineX

  // 1.4.7 Set v = xR mod n
  var v = global.BigInt(xR.toString()) % n

  // 1.4.8 If v = r, output "valid", and if v != r, output "invalid"
  return v === r
}

module.exports = {
  deterministicGenerateK: deterministicGenerateK,
  sign: sign,
  verify: verify,

  // TODO: remove
  __curve: secp256k1
}
