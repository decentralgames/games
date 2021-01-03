const Roulette = artifacts.require("dgRoulette");
const Slots = artifacts.require("dgSlots");
const Backgammon = artifacts.require("dgBackgammon");
const Treasury = artifacts.require("dgTreasury");
const Token = artifacts.require("dgToken");
const Pointer = artifacts.require("dgPointer");
const name = "name";
const version = "0";

const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");
require("colors");

const BN = web3.utils.BN;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const HASH_CHAIN = [
    "0x7f7e3e79bc27e06158e71e3d1ad06c358ac9634e29875cd95c3041e0206494d5",
    "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
    "0x85b19f01fe40119c675666a851d9e6b9a85424dc4016b2de0bdb69efecf08dea",
    "0x28ecea1ba1f63e6973e214182b87fce258a89705e40360fddcf00cad0f905730",
    "0xd1f07819ba177c9c9977dade4370f99942f8a5e24ea36750207d890293c7866f",
    "0x5ef64968497705b2ad68ed5ebb3a8edd478a5cab3e443cb44429bc9de7766149",
    "0xf8bf31336d2f22ffb04bff206dc338f4f96ffd243281fdc2268435d92f70988f"
];

const getLastEvent = async (eventName, instance) => {
    const events = await instance.getPastEvents(eventName, {
        fromBlock: 0,
        toBlock: "latest"
    });
    return events.pop().returnValues;
};

contract("dgTreasury", ([owner, user1, user2, user3, random]) => {

    let roulette, slots, token, treasury;

    describe("Initial Values", () => {
        before(async () => {
            token = await Token.new();
            treasury = await Treasury.new(token.address, "MANA");
        });

        it("correct default token name and address", async () => {
            const res = await treasury.treasuryTokens(0);
            assert.equal(res.tokenName, "MANA");
            assert.equal(res.tokenAddress, token.address);
        });

        it("correct CEO address", async () => {
            const ceo = await treasury.ceoAddress();
            assert.equal(ceo, owner);

            const event = await getLastEvent("CEOSet", treasury);
            assert.equal(event.newCEO, owner);
        });

        it("correct worker address", async () => {
            const worker = await treasury.workerAddress();
            assert.equal(worker, owner);
        });
    });

    describe("Adding Games", () => {

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            roulette = await Roulette.new(treasury.address, 4000, 36, pointer.address);
            slots = await Slots.new(treasury.address, 250, 16, 8, 4, pointer.address);
        });

        it("only CEO can add a game", async () => {
            await catchRevert(
                treasury.addGame(slots.address, "Slots", false, { from: random })
            );
            await treasury.addGame(slots.address, "Slots", false, { from: owner });
        });

        it("correct game details after added", async () => {
            await treasury.addGame(slots.address, "Slots", false, { from: owner });
            await treasury.addGame(roulette.address, "Roulette", false, { from: owner });

            const slotsInfo = await treasury.treasuryGames(0);
            const slotsMaxBet = await treasury.gameMaximumBet(0, 0);
            assert.equal(slotsInfo.gameAddress, slots.address);
            assert.equal(slotsInfo.gameName, "Slots");
            assert.equal(slotsMaxBet, 0);

            await treasury.setMaximumBet(0, 0, 100, { from: owner });
            const slotsMaxBetSet = await treasury.gameMaximumBet(0, 0);
            assert.equal(slotsMaxBetSet, 100);

            const rouletteInfo = await treasury.treasuryGames(1);
            const rouletteMaxBet = await treasury.gameMaximumBet(1, 0);
            assert.equal(rouletteInfo.gameAddress, roulette.address);
            assert.equal(rouletteInfo.gameName, "Roulette");
            assert.equal(rouletteMaxBet, 0);

            await treasury.setMaximumBet(1, 0, 200, { from: owner });
            const rouletteMaxBetSet = await treasury.gameMaximumBet(1, 0);
            assert.equal(rouletteMaxBetSet, 200);
        });
    });

    describe("Adding Funds to a Game", () => {
        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            roulette = await Roulette.new(treasury.address, 4000, 36, pointer.address);
            slots = await Slots.new(treasury.address, 250, 16, 8, 4, pointer.address);
            await treasury.addGame(slots.address, "Slots", true, { from: owner });
            await treasury.addGame(roulette.address, "Roulette", true, { from: owner });
            await treasury.setMaximumBet(0, 0, 100, { from: owner });
            await treasury.setMaximumBet(1, 0, 200, { from: owner });
        });

        it("should revert if token is not approved first", async () => {
            await catchRevert(treasury.addFunds(0, 0, 1000, { from: owner }));
            await token.approve(treasury.address, 1000);
            await treasury.addFunds(0, 0, 1000, { from: owner });
        });

        it("should revert if token is not registered first", async () => {
            await catchRevert(treasury.addFunds(0, 0, 1000, { from: owner }));
            await token.approve(treasury.address, 1000);
            await treasury.addFunds(0, 0, 1000, { from: owner });
            await catchRevert(treasury.addFunds(0, 1, 1000, { from: owner }));
        });

        it("should revert if user does not have enough funds", async () => {
            await token.approve(treasury.address, 0, { from: random });
            await catchRevert(treasury.addFunds(0, 0, 1000, { from: random }));
        });

        it("contract token balance should update to funds sent", async () => {
            await token.approve(treasury.address, 1000);
            await treasury.addFunds(0, 0, 1000, { from: owner });

            const balance = await token.balanceOf(treasury.address);
            assert.equal(balance, 1000);
        });

        it("correct allocated tokens in game", async () => {
            await token.approve(treasury.address, 1000);
            await treasury.addFunds(0, 0, 1000, { from: owner });

            const allocated = await treasury.checkGameTokens(0, 0);
            assert.equal(allocated, 1000);
        });
    });

    describe("Removing Funds", () => {
        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            roulette = await Roulette.new(treasury.address, 4000, 36, pointer.address);
            await treasury.addGame(roulette.address, "Roulette", true, { from: owner });
            await token.approve(treasury.address, 1000, { from: owner });
            await treasury.addFunds(0, 0, 1000, { from: owner });
        });

        it("only CEO can remove funds from a game", async () => {
            await catchRevert(
                treasury.withdrawGameTokens(0, 0, 1000, { from: random })
            );
            treasury.withdrawGameTokens(0, 0, 1000, { from: owner });
        });

        it("should revert if amount value is greater than game funds", async () => {
            await catchRevert(
                treasury.withdrawGameTokens(0, 0, 2000, { from: owner })
            );
            treasury.withdrawGameTokens(0, 0, 1000, { from: owner })
        });

        it("CEO should be able to remove funds", async () => {
            await treasury.withdrawGameTokens(0, 0, 1000, { from: owner });
            const allocated = await treasury.checkGameTokens(0, 0);
            assert.equal(allocated, 0);
        });

        it("correct game balance after withdrawl", async () => {
            await treasury.withdrawGameTokens(0, 0, 200, { from: owner });

            const allocated = await treasury.checkGameTokens(0, 0);
            assert.equal(allocated, 800);
        });

        it("correct CEO balance after withdraw", async () => {
            const initialTreasuryBalance = await token.balanceOf(treasury.address);
            const initialOwnerBalance = await token.balanceOf(owner);

            assert.equal(initialTreasuryBalance, 1000);

            await treasury.withdrawGameTokens(0, 0, 200, { from: owner });

            const finalOwnerBalance = await token.balanceOf(owner);
            const finalTreasuryBalance = await token.balanceOf(treasury.address);

            const newOwnerBalance = initialOwnerBalance + initialTreasuryBalance;

            assert(finalOwnerBalance > initialOwnerBalance);
            assert.equal(finalTreasuryBalance, 800);
            // assert.equal(finalOwnerBalance, newOwnerBalance);
        });

        it("only CEO can remove all token balance of contract", async () => {
            await catchRevert(
                treasury.withdrawTreasuryTokens(0, { from: random })
            );
            await treasury.withdrawTreasuryTokens(0, { from: owner });

            const allocated = await treasury.checkGameTokens(0, 0);
            assert.equal(allocated, 0);
            const balance = await token.balanceOf(treasury.address);
            assert.equal(balance, 0);
        });
    });

    describe("Game Play: Roulette", () => {
        const betTypes = [0, 2, 5];
        const betValues = [20, 1, 1];
        const betAmount = [500, 300, 400];
        const tokenIndex = [0, 0, 0];

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            roulette = await Roulette.new(treasury.address, 4000, 36, pointer.address);
            await treasury.addGame(roulette.address, "Roulette", true, { from: owner });
            await treasury.setMaximumBet(0, 0, 1000, { from: owner });
            await token.approve(treasury.address, web3.utils.toWei("100"));
            await treasury.addFunds(0, 0, web3.utils.toWei("100"), {
                from: owner
            });
            await token.transfer(user1, 10000);
            await token.transfer(user2, 10000);
            await token.transfer(user3, 10000);
            await treasury.setTail(
                "0x7f7e3e79bc27e06158e71e3d1ad06c358ac9634e29875cd95c3041e0206494d5",
                { from: owner }
            );
        });

        it("only CEO can set tail", async () => {
            await catchRevert(
                treasury.setTail(
                    "0xd1f07819ba177c9c9977dade4370f99942f8a5e24ea36750207d890293c7866f",
                    { from: random }
                )
            );
            await treasury.setTail(
                "0xd1f07819ba177c9c9977dade4370f99942f8a5e24ea36750207d890293c7866f",
                { from: owner }
            );
        });

        it("should be able to play game", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await advanceTimeAndBlock(60);
            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                tokenIndex,
                3,
                [0,0,0],
                { from: owner }
            );
        });

        it("play function can only be called by worker", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await advanceTimeAndBlock(60);

            await catchRevert(
                roulette.play(
                    [user1, user2, user3],
                    1,
                    2,
                    betTypes,
                    betValues,
                    betAmount,
                    "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                    [0],
                    3,
                    [0,0,0],
                    { from: random }
                ),
                "revert"
            );

            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                tokenIndex,
                3,
                [0,0,0],
                { from: owner }
            );
        });

        it("user has to approve the transfer of tokens from treasury first", async () => {
            await catchRevert(
                roulette.play(
                    [user1, user2, user3],
                    1,
                    2,
                    betTypes,
                    betValues,
                    betAmount,
                    "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                    tokenIndex,
                    3,
                    [0,0,0],
                    { from: owner }
                ),
                "revert approve treasury as spender"
            );

            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await advanceTimeAndBlock(60);
            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                tokenIndex,
                3,
                [0,0,0],
                { from: owner }
            );
        });

        it("should revert if bet amount and values are not equal length", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });

            await catchRevert(
                roulette.play(
                    [user1, user2, user3],
                    1,
                    2,
                    [0, 0], // Arrays not equal length
                    betValues,
                    betAmount,
                    "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                    tokenIndex,
                    3,
                    [0,0,0],
                    { from: owner }
                ),
                "revert inconsistent amount of bets"
            );
        });

        it("should revert if it exceeds maximum amount of game bet", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await catchRevert(
                roulette.play(
                    [user1, user2, user3],
                    1,
                    2,
                    betTypes,
                    betValues,
                    [500, 300, 3000],
                    "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                    tokenIndex,
                    3,
                    [0,0,0],
                    { from: owner }
                ),
                "revert bet amount is more than maximum"
            );
        });

        it("should emit a GameResult event with correct details", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await advanceTimeAndBlock(60);
            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                tokenIndex,
                3,
                [0,0,0],
                { from: owner }
            );
            const { _players, _tokenIndex, _landID, _machineID } = await getLastEvent(
                "GameResult",
                roulette
            );

            assert.equal(
                JSON.stringify(_players),
                JSON.stringify([user1, user2, user3])
            );
            assert.equal(JSON.stringify(_tokenIndex), JSON.stringify(["0","0","0"]));
            assert.equal(_landID, 1);
            assert.equal(_machineID, 2);
        });

        it("should revert if uses same local hash after a play", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await advanceTimeAndBlock(60);
            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                tokenIndex,
                3,
                [0,0,0],
                { from: owner }
            );

            await catchRevert(
                roulette.play(
                    [user1, user2, user3],
                    1,
                    2,
                    betTypes,
                    betValues,
                    betAmount,
                    "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                    tokenIndex,
                    3,
                    [0,0,0],
                    { from: owner }
                ),
                "revert hash-chain: wrong parent"
            );
        });

        it("should be able to play if uses correct next local hash after a play", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await advanceTimeAndBlock(60);
            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                [0, 0, 0],
                3,
                [0,0,0],
                { from: owner }
            );

            await advanceTimeAndBlock(60);
            await token.approve(treasury.address, 5000, { from: user3 });
            await advanceTimeAndBlock(60);

            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0x85b19f01fe40119c675666a851d9e6b9a85424dc4016b2de0bdb69efecf08dea",
                [0, 0, 0],
                3,
                [0,0,0],
                { from: owner }
            );

            await advanceTimeAndBlock(1);
            await roulette.play(
                [user1, user2, user3],
                1,
                2,
                betTypes,
                betValues,
                betAmount,
                "0x28ecea1ba1f63e6973e214182b87fce258a89705e40360fddcf00cad0f905730",
                [0, 0, 0],
                3,
                [0,0,0],
                { from: owner }
            );

        });
    });

    describe("Game Results: Roulette", () => {
        const betTypes = [0, 2, 5, 1, 3];
        const betValues = [31, 0, 2, 1, 1];
        const betAmounts = [500, 300, 400, 100, 200];
        const tokenIndex = [0, 0, 0, 0, 0];

        beforeEach(async () => {
            // Deploy contracts
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            roulette = await Roulette.new(treasury.address, 4000, 36, pointer.address);

            // Add game and fund it
            await treasury.addGame(roulette.address, "Roulette", true, { from: owner });
            await treasury.setMaximumBet(0, 0, 2000, { from: owner });
            await token.approve(treasury.address, 1e7);
            await treasury.addFunds(0, 0, 1e7, {
                from: owner
            });

            // Prepare user1
            await token.transfer(user1, 1e5);
            await token.approve(treasury.address, 1e5, {
                from: user1
            });

            await treasury.setTail(HASH_CHAIN[0], { from: owner });
        });

        it("user should get correct winning tokens", async () => {
            let beforeBetUser,
                afterBetUser,
                totalBet = 0,
                winTotal = 0;
            beforeBetUser = await token.balanceOf(user1);

            for (let i = 0; i < 4; i++) {
                totalBet += betAmounts.reduce((a, b) => a + b);
                await advanceTimeAndBlock(60);
                await roulette.play(
                    [user1, user1, user1, user1, user1],
                    1,
                    2,
                    betTypes,
                    betValues,
                    betAmounts,
                    HASH_CHAIN[i + 1],
                    tokenIndex,
                    1,
                    [0,0,0,0,0],
                    { from: owner }
                );

                const { _winAmounts } = await getLastEvent("GameResult", roulette);

                console.log(
                    `     Play ${i + 1}: WinAmounts:[${_winAmounts}]`.cyan.inverse
                );

                winTotal = _winAmounts.reduce((a, b) => Number(a) + Number(b));
                // If there is a win stop
                if (winTotal > 0) {
                    winAmounts = _winAmounts;
                    break;
                }
            }
            afterBetUser = await token.balanceOf(user1);

            // AfterBalance = InitialBalance - amountBet + AmountWin
            assert.equal(
                afterBetUser.toNumber(),
                beforeBetUser.toNumber() + Number(winTotal) - totalBet
            );
        });

        it("correct game token balance after win", async () => {
            let beforeBetGame,
                afterBetGame,
                amountWin,
                totalBet = 0,
                winTotal = 0;

            beforeBetGame = await treasury.checkGameTokens(0, 0);

            for (let i = 0; i < 4; i++) {
                totalBet += betAmounts.reduce((a, b) => a + b);

                await advanceTimeAndBlock(60);
                await roulette.play(
                    [user1, user1, user1, user1, user1],
                    1,
                    2,
                    betTypes,
                    betValues,
                    betAmounts,
                    HASH_CHAIN[i + 1],
                    tokenIndex,
                    1,
                    [0,0,0,0,0],
                    { from: owner }
                );

                const { _winAmounts } = await getLastEvent("GameResult", roulette);

                console.log(
                    `     Play ${i + 1}: WinAmounts:[${_winAmounts}]`.cyan.inverse
                );

                winTotal = _winAmounts.reduce((a, b) => Number(a) + Number(b));
                // If there is a win stop
                if (winTotal > 0) {
                    winAmounts = _winAmounts;
                    break;
                }
            }

            afterBetGame = await treasury.checkGameTokens(0, 0);

            assert.equal(
                afterBetGame.toNumber(),
                beforeBetGame.toNumber() + totalBet - Number(winTotal)
            );
        });
    });

    describe("Game Play: Slots", () => {
        const betTypes = [0];
        const betValues = [0];
        const betAmounts = [500];

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            slots = await Slots.new(treasury.address, 250, 16, 8, 4, pointer.address);
            await treasury.addGame(slots.address, "Slots", true, { from: owner });
            await treasury.setMaximumBet(0, 0, 1000, { from: owner });
            await token.approve(treasury.address, web3.utils.toWei("100"));
            await treasury.addFunds(0, 0, web3.utils.toWei("100"), {
                from: owner
            });
            await token.transfer(user1, 10000);
            await token.approve(treasury.address, 5000, { from: user1 });

            await treasury.setTail(HASH_CHAIN[0], { from: owner });
        });

        it("should revert if exceeds maximum amount of game bet", async () => {
            await catchRevert(
                slots.play(
                    user1,
                    1,
                    2,
                    2000,
                    HASH_CHAIN[1],
                    0,
                    0,
                    { from: owner }
                ),
                "revert bet amount is more than maximum"
            );
        });

        it("should be able to play slots", async () => {
            await advanceTimeAndBlock(60);
            await slots.play(
                user1,
                1,
                2,
                100,
                HASH_CHAIN[1],
                0,
                0,
                { from: owner }
            );
        });

        it("should emit a GameResult event with correct details", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await advanceTimeAndBlock(60);
            await slots.play(
                user1,
                1,
                2,
                100,
                HASH_CHAIN[1],
                0,
                0,
                { from: owner }
            );
            const { _player, _tokenIndex, _landID, _machineID } = await getLastEvent(
                "GameResult",
                slots
            );
            assert.equal(JSON.stringify(_player), JSON.stringify(user1));
            assert.equal(_tokenIndex, 0);
            assert.equal(_landID, 1);
            assert.equal(_machineID, 2);
        });
    });

    describe("Game Results: Slots", () => {
        const betAmounts = 500;

        beforeEach(async () => {
            // Deploy contracts
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            slots = await Slots.new(treasury.address, 250, 16, 8, 4, pointer.address);

            // Add game and fund it
            await treasury.addGame(slots.address, "Slots", { from: owner });
            await treasury.setMaximumBet(0, 0, 10000, { from: owner });
            await token.approve(treasury.address, 1e7);
            await treasury.addFunds(0, 0, 1e7, {
                from: owner
            });

            // Prepare user1
            await token.transfer(user1, 1e5);
            await token.approve(treasury.address, 1e5, {
                from: user1
            });

            await treasury.setTail(
                "0x7f7e3e79bc27e06158e71e3d1ad06c358ac9634e29875cd95c3041e0206494d5",
                { from: owner }
            );
        });

        it("user should get correct winning tokens", async () => {
            let beforeBetUser,
                afterBetUser,
                totalBet = 0,
                winTotal = 0;

            beforeBetUser = await token.balanceOf(user1);

            for (let i = 0; i < 5; i++) {
                totalBet += 500;
                await advanceTimeAndBlock(60);
                await slots.play(
                    user1,
                    1,
                    12,
                    betAmounts,
                    HASH_CHAIN[i + 1],
                    0,
                    0,
                    { from: owner }
                );

                const { _winAmount } = await getLastEvent("GameResult", slots);

                console.log(
                    `     Play ${i + 1}: WinAmount:[${_winAmount}]`.cyan.inverse
                );

                if (_winAmount > 0) {
                    winTotal = _winAmount;
                    break;
                }
            }

            afterBetUser = await token.balanceOf(user1);

            assert.equal(
                afterBetUser.toNumber(),
                beforeBetUser.toNumber() + Number(winTotal) - totalBet
            );
        });

        it("correct game token balance after win", async () => {
            let beforeBetGame,
                afterBetGame,
                totalBet = 0,
                winTotal = 0;

            beforeBetGame = await treasury.checkGameTokens(0, 0);

            for (let i = 0; i < 5; i++) {
                totalBet += 500;
                await advanceTimeAndBlock(60);
                await slots.play(
                    user1,
                    1,
                    2,
                    betAmounts,
                    HASH_CHAIN[i + 1],
                    0,
                    0,
                    { from: owner }
                );

                const { _winAmount } = await getLastEvent("GameResult", slots);

                console.log(
                    `     Play ${i + 1}: WinAmounts:[${_winAmount}]`.cyan.inverse
                );

                if (_winAmount > 0) {
                    winTotal = _winAmount;
                    break;
                }
            }

            afterBetGame = await treasury.checkGameTokens(0, 0);

            assert.equal(
                afterBetGame.toNumber(),
                beforeBetGame.toNumber() + totalBet - winTotal
            );
        });
    });

    describe("Game Play: Backgammon", () => {

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            backgammon = await Backgammon.new(treasury.address, 4, 10, pointer.address);
            await treasury.addGame(backgammon.address, "Backgammon", true, { from: owner });
            await treasury.setMaximumBet(0, 0, web3.utils.toWei("10000"), { from: owner });
            await token.approve(treasury.address, 10000000000);
            await treasury.addFunds(0, 0, 10000000, {
                from: owner
            });
            await token.transfer(user1, 100000);
            await token.transfer(user2, 100000);
            // await token.approve(treasury.address, 5000, { from: user1 });

            await treasury.setTail(HASH_CHAIN[0], { from: owner });
        });

        it("should revert if player1 == player2", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await catchRevert(
                backgammon.initializeGame(
                    0,
                    user1,
                    user1,
                    0,
                    0,
                    0,
                    { from: owner }
                ),
                "revert must be two different players"
            );
        });

        it("should revert if users didnt approve treasury", async () => {

            await catchRevert(
                backgammon.initializeGame(
                    10,
                    user1,
                    user2,
                    0,
                    0,
                    0,
                    { from: owner }
                ),
                "revert P1 must approve/allow treasury as spender"
            );

            await token.approve(treasury.address, 5000000, { from: user1 });
            await catchRevert(
                backgammon.initializeGame(
                    1,
                    user1,
                    user2,
                    0,
                    0,
                    0,
                    { from: owner }
                ),
                "revert P2 must approve/allow treasury as spender"
            );

            await token.approve(treasury.address, 5000000, { from: user2 });
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;
            await backgammon.initializeGame(
                1,
                user1,
                user2,
                0,
                playerOneWearableBonus,
                playerTwoWearableBonus,
                { from: owner }
            );

            const { gameId, playerOne, playerTwo, tokenIndex } = await getLastEvent(
                "GameStarted",
                backgammon
            );

            assert.equal(playerOne, user1);
            assert.equal(playerTwo, user2);
            assert.equal(tokenIndex, 0);

        });


        it("should revert if game already started", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;
            backgammon.initializeGame(
                0,
                user1,
                user2,
                0,
                playerOneWearableBonus,
                playerTwoWearableBonus,
                { from: owner }
            )

            await catchRevert(
                backgammon.initializeGame(
                    0,
                    user1,
                    user2,
                    0,
                    playerOneWearableBonus,
                    playerTwoWearableBonus,
                    { from: owner }
                ),
                "revert cannot initialize running game"
            );
        });

        it("should revert if unknown token provided", async () => {
            await catchRevert(
                backgammon.initializeGame(
                    0,
                    user1,
                    user2,
                    1,
                    0,
                    0,
                    { from: owner }
                ),
                "revert cannot initialize running game"
            );
        });

        it("should be able to initialize game", async () => {
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;
            await backgammon.initializeGame(
                0,
                user1,
                user2,
                0,
                playerOneWearableBonus,
                playerTwoWearableBonus,
                { from: owner }
            );

            const { gameId, playerOne, playerTwo, tokenIndex } = await getLastEvent(
                "GameStarted",
                backgammon
            );

            assert.equal(playerOne, user1);
            assert.equal(playerTwo, user2);
            assert.equal(tokenIndex, 0);

        });

        it("should be able to raise double (only on initialized game)", async () => {

            const staked = 10

            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;
            await backgammon.initializeGame(
                staked,
                user1,
                user2,
                0,
                playerOneWearableBonus,
                playerTwoWearableBonus,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);

            await backgammon.raiseDouble(
                _gameID,
                user1,
                { from: owner }
            );

            const { gameId, player, stake } = await getLastEvent(
                "StakeRaised",
                backgammon
            );

            assert.equal(gameId, _gameID);
            assert.equal(player, user1);
            assert.equal(stake, staked * 3);

            await catchRevert(
                backgammon.raiseDouble(
                    gameId,
                    user1,
                    { from: owner }
                ),
                "revert must be ongoing game"
            );
        });

        it("should be able to callDouble (only in doubling-stage)", async () => {
            const staked = 10
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;
            await backgammon.initializeGame(
                staked,
                user1,
                user2,
                0,
                playerOneWearableBonus,
                playerTwoWearableBonus,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);

            await backgammon.raiseDouble(
                _gameID,
                user1,
                { from: owner }
            );

            await catchRevert(
                backgammon.callDouble(
                    _gameID,
                    user1,
                    { from: owner }
                ),
                "revert call must come from opposite player who doubled"
            );

            await catchRevert(
                backgammon.callDouble(
                    _gameID,
                    user3,
                    { from: owner }
                ),
                "revert must be one of the players"
            );

            await backgammon.callDouble(
                _gameID,
                user2,
                { from: owner }
            );

            const { gameId, player, totalStaked } = await getLastEvent(
                "StakeDoubled",
                backgammon
            );

            assert.equal(gameId, _gameID);
            assert.equal(player, user2);
            assert.equal(totalStaked, staked * 4);

        });

        it("should be able to drop game (only in doubling-stage)", async () => {
            const staked = 10
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            const treasuryBalanceBefore = await token.balanceOf(treasury.address);

            await backgammon.initializeGame(
                staked,
                user1,
                user2,
                0,
                playerOneWearableBonus,
                playerTwoWearableBonus,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);

            await backgammon.raiseDouble(
                _gameID,
                user1,
                { from: owner }
            );

            await catchRevert(
                backgammon.dropGame(
                    _gameID,
                    user1,
                    { from: owner }
                ),
                "revert call must come from opposite player who doubled"
            );

            await catchRevert(
                backgammon.dropGame(
                    _gameID,
                    user3,
                    { from: owner }
                ),
                "revert must be one of the players"
            );

            await backgammon.dropGame(
                _gameID,
                user2,
                { from: owner }
            );

            const treasuryBalanceAfter = await token.balanceOf(treasury.address);

            const { gameId, player} = await getLastEvent(
                "PlayerDropped",
                backgammon
            );

            assert.equal(gameId, _gameID);
            assert.equal(player, user2);

            const { value } = await getLastEvent(
                "Transfer",
                token
            );

            const fee = staked * 3 - value;

            assert.equal(value, staked * 3 * 0.90);
            assert.equal(
                web3.utils.toBN(treasuryBalanceBefore).add(web3.utils.toBN(fee)).toString(),
                treasuryBalanceAfter.toString()
            );
        });
    });

    describe("Game Play: Roulette Special Cases", () => {
        const players = [
            user1,
            user1,
            user1,
            user1,
            user1,
            user1,
            user1,
            user1,
            user1,
            user1,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2,
            user2
        ];
        const betTypes = new Array(30).fill(0);
        const betValues = [
            5,14,15,20,21,24,26,27,30,36,1,2,4,7,8,10,
            11,13,16,17,19,22,23,25,28,29,31,32,34,35
        ];
        const betAmount = [
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '1000000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000',
            '50000000000000000000'
        ];

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            treasury = await Treasury.new(token.address, "MANA");
            roulette = await Roulette.new(treasury.address, web3.utils.toWei("400000"), 50, pointer.address);
            await treasury.addGame(roulette.address, "Roulette", true, { from: owner });
            await treasury.setMaximumBet(0, 0, web3.utils.toWei("1000000000"), { from: owner });
            await token.approve(treasury.address, web3.utils.toWei("100000000"));
            await treasury.addFunds(0, 0, web3.utils.toWei("100000000"), {
                from: owner
            });
            await token.transfer(user1, web3.utils.toWei("1000000000"));
            await token.transfer(user2, web3.utils.toWei("1000000000"));
            await token.transfer(user3, web3.utils.toWei("1000000000"));
            await treasury.setTail(
                "0x7f7e3e79bc27e06158e71e3d1ad06c358ac9634e29875cd95c3041e0206494d5",
                { from: owner }
            );
        });

        it("only CEO can set tail", async () => {
            await catchRevert(
                treasury.setTail(
                    "0xd1f07819ba177c9c9977dade4370f99942f8a5e24ea36750207d890293c7866f",
                    { from: random }
                )
            );
            await treasury.setTail(
                "0xd1f07819ba177c9c9977dade4370f99942f8a5e24ea36750207d890293c7866f",
                { from: owner }
            );
        });

        it("should be able to play game (30 bets)", async () => {
            await token.approve(treasury.address, web3.utils.toWei("100000000"), { from: user1 });
            await token.approve(treasury.address, web3.utils.toWei("100000000"), { from: user2 });
            await token.approve(treasury.address, web3.utils.toWei("100000000"), { from: user3 });
            await advanceTimeAndBlock(60);

            await treasury.setTail(
                "0x7f7e3e79bc27e06158e71e3d1ad06c358ac9634e29875cd95c3041e0206494d5",
                { from: owner }
            );

            await roulette.play(
                players,
                3,
                10,
                betTypes,
                betValues,
                betAmount,
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                new Array(players.length).fill(0),
                2,
                new Array(players.length).fill(0),
                { from: owner }
            );
        });

        it("should be able to play game (31 bets)", async () => {
            await token.approve(treasury.address, web3.utils.toWei("10000000000000"), { from: user1 });
            await token.approve(treasury.address, web3.utils.toWei("10000000000000"), { from: user2 });
            await token.approve(treasury.address, web3.utils.toWei("10000000000000"), { from: user3 });
            await advanceTimeAndBlock(60);
            await treasury.setTail(
                "0x7f7e3e79bc27e06158e71e3d1ad06c358ac9634e29875cd95c3041e0206494d5",
                { from: owner }
            );
            await roulette.play(
                new Array(31).fill(user2),
                3,
                20110003002006,
                new Array(31).fill(0),
                [
                    1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,
                    18,19,20,21,22,23,25,26,28,29,31,32,34,35
                ],
                new Array(31).fill('50000000000000000000'),
                "0xd3ea1389b1549688059ed3bb1c8d9fe972389e621d1341ec4340dc468fd5576d",
                new Array(31).fill(0),
                1,
                new Array(31).fill(0),
                { from: owner }
            );
        });
    });
});
