const util = require('./util.js');

var algos = module.exports = global.algos = { 
	'komodo': { 
		diff1: parseInt('0x0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f'), //The highest possible target
		mindiff: parseInt('0x200f0f0f') 
	},
	'zcash': { 
		diff1: parseInt('0x0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
		mindiff: parseInt('0x00ffffff') 
	}
};
