// Copyright (c) 2018-2025 TheComputerGenie
// Distributed under the GNU GENERAL PUBLIC LICENSE software license, see the accompanying
// file LICENSE or https://www.gnu.org/licenses/gpl-3.0.en.html

module.exports = function () {
    const date = new Date;
    const timestamp = `${(`0${date.getMonth() + 1}`).slice(-2)}/${(`0${date.getDate()}`).slice(-2)} ${(`0${date.getHours()}`).slice(-2)}:${(`0${date.getMinutes()}`).slice(-2)}:${(`0${date.getSeconds()}`).slice(-2)}`;
    return timestamp;
};
