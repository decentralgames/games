const Token = artifacts.require("Token");
const dgTreasury = artifacts.require("dgTreasury");
const dgRoulette = artifacts.require("dgRoulette");
const dgSlots = artifacts.require("dgSlots");
const dgBackgammon = artifacts.require("dgBackgammon");
const dgBlackJack = artifacts.require("dgBlackJack");
const dgPointer = artifacts.require("dgPointer");

module.exports = async function(deployer, network, accounts) {

    if (network == 'development') {
    }

    if (network == 'matic') {
    }

    if (network == 'maticmain') {
        await deployer.deploy(dgPointer, '0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4');
        await deployer.deploy(dgTreasury, '0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4', 'MANA');
        await deployer.deploy(dgSlots, dgTreasury.address, 250, 15, 8, 4, dgPointer.address);
        await deployer.deploy(dgRoulette, dgTreasury.address, '4000000000000000000000', 36);
        await deployer.deploy(dgBackgammon, dgTreasury.address, 64, 10, dgPointer.address);
        await deployer.deploy(dgBlackJack, '0x14Bb841662B1806E9Fa03286A0Db0B090eb8b416', dgPointer.address, 4);
    }
};
