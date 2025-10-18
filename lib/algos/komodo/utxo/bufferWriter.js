// Copyright (c) 2011-2017 bitcoinjs-lib contributors
// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

const bufferutils = require('./bufferutils');

function BufferWriter(bufferSize) {
    this.buffer = Buffer.allocUnsafe(bufferSize);
    this.offset = 0;
}

BufferWriter.prototype.getBuffer = function () {
    return this.buffer;
};

BufferWriter.prototype.writeSlice = function (slice) {
    this.offset += slice.copy(this.buffer, this.offset);
};

BufferWriter.prototype.writeInt32 = function (input) {
    this.offset = this.buffer.writeInt32LE(input, this.offset);
};

BufferWriter.prototype.writeUInt32 = function (input) {
    this.offset = this.buffer.writeUInt32LE(input, this.offset);
};

BufferWriter.prototype.writeUInt64 = function (input) {
    this.offset = bufferutils.writeUInt64LE(this.buffer, input, this.offset);
};

BufferWriter.prototype.writeVarInt = function (input) {
    bufferutils.varIntBuffer(input, this.buffer, this.offset);
    this.offset += bufferutils.varIntBuffer.bytes;
};

BufferWriter.prototype.writeVarSlice = function (slice) {
    this.writeVarInt(slice.length);
    this.writeSlice(slice);
};

module.exports = BufferWriter;