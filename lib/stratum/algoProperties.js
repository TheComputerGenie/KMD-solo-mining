const util = require('./util.js');
const diff1 = global.diff1 = 0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
// TODO: there's no reason to have both diffs, but deep edits needed elsewhere to use just 1
var algos = module.exports = global.algos = { 'equihash': { diff: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') } };
