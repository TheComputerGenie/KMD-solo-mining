const util = require('./util.js');
const diff1 = global.diff1 = 0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
/**
 * @todo Set to Komodo diffs
 * @body this diff is "wrong" and the reason all the rest of the math is off.
 */
var algos = module.exports = global.algos = { 'equihash': { diff: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') } };
