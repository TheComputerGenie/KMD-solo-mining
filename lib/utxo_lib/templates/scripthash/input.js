// <scriptSig> {serialized scriptPubKey script}

const bscript = require('../../script');
const typeforce = require('../../typeforce');

const p2pk = require('../pubkey/');
const p2pkh = require('../pubkeyhash/');

function check(script, allowIncomplete) {
    const chunks = bscript.decompile(script);
    if (chunks.length < 1) {
        return false;
    }

    const lastChunk = chunks[chunks.length - 1];
    if (!Buffer.isBuffer(lastChunk)) {
        return false;
    }

    const scriptSigChunks = bscript.decompile(bscript.compile(chunks.slice(0, -1)));
    const redeemScriptChunks = bscript.decompile(lastChunk);

    // is redeemScript a valid script?
    if (redeemScriptChunks.length === 0) {
        return false;
    }

    // is redeemScriptSig push only?
    if (!bscript.isPushOnly(scriptSigChunks)) {
        return false;
    }

    // match types
    if (p2pkh.input.check(scriptSigChunks) &&
    p2pkh.output.check(redeemScriptChunks)) {
        return true;
    }

    if (p2pk.input.check(scriptSigChunks) &&
    p2pk.output.check(redeemScriptChunks)) {
        return true;
    }

    return false;
}
check.toJSON = function () {
    return 'scriptHash input'; 
};

function encodeStack(redeemScriptStack, redeemScript) {
    const serializedScriptPubKey = bscript.compile(redeemScript);

    return [].concat(redeemScriptStack, serializedScriptPubKey);
}

function encode(redeemScriptSig, redeemScript) {
    const redeemScriptStack = bscript.decompile(redeemScriptSig);

    return bscript.compile(encodeStack(redeemScriptStack, redeemScript));
}

function decodeStack(stack) {
    typeforce(check, stack);

    return {
        redeemScriptStack: stack.slice(0, -1),
        redeemScript: stack[stack.length - 1]
    };
}

function decode(buffer) {
    const stack = bscript.decompile(buffer);
    const result = decodeStack(stack);
    result.redeemScriptSig = bscript.compile(result.redeemScriptStack);
    delete result.redeemScriptStack;
    return result;
}

module.exports = {
    check: check,
    decode: decode,
    decodeStack: decodeStack,
    encode: encode,
    encodeStack: encodeStack
};
