const Roulette = artifacts.require("dgRoulette");
const Treasury = artifacts.require("dgTreasury");
const Token = artifacts.require("dgToken");
const Pointer = artifacts.require("dgPointer");
const name = "name";
const version = "0";
const {catchRevert, catchSquareLimit} = require("./exceptionsHelpers.js");

require("./utils");

const getLastEvent = async (eventName, instance) => {
    const events = await instance.getPastEvents(eventName, {
        fromBlock: 0,
        toBlock: "latest"
    });
    return events.pop().returnValues;
};

contract("TreasuryRoulette", ([owner, user1, user2, random]) => {
    let roulette;

    describe("Initial Variables", () => {
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
        });

        it("correct initial round timestamp", async () => {
            const ts = await roulette.getNextRoundTimestamp();

            const block = await web3.eth.getBlockNumber();
            const info = await web3.eth.getBlock(block);

            assert.equal(ts.toNumber(), info.timestamp);
        });

        it("correct initial bet amounts", async () => {
            const amount = await roulette.getBetsCount();
            assert.equal(amount, 0);
        });

        it("correct initial values", async () => {
            let payout;
            payout = await roulette.getPayoutForType(0, 1);
            assert.equal(payout, 36);

            payout = await roulette.getPayoutForType(1,1);
            assert.equal(payout, 2);

            payout = await roulette.getPayoutForType(2,1);
            assert.equal(payout, 2);

            payout = await roulette.getPayoutForType(3,1);
            assert.equal(payout, 2);

            payout = await roulette.getPayoutForType(4,1);
            assert.equal(payout, 3);

            payout = await roulette.getPayoutForType(5,1);
            assert.equal(payout, 3);
        });

        it("correct payout for type", async () => {
            const res = await roulette.getBetsCountAndValue();
            assert.equal(res["0"], 0);
            assert.equal(res["1"], 0);
        });
    });

    describe("Betting: Single", () => {
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
        });

        it("should let user create a single bet", async () => {
            await roulette.createBet(user1, 0, 2, 0, 1000);
        });

        it("should emit NewSingleBet event", async () => {
            await roulette.createBet(user1, 0, 20, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 0, 20, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 20);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 0);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 0, 20, 0, 1000);
            const userBet = await roulette.bets(0);
            const res = await roulette.getBetsCountAndValue();
            assert.equal(res["1"], 1000);

            assert.equal(user1, userBet.player);
            assert.equal(20, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 0);
        });
    });

    describe("Betting: Even", () => {
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
        });

        it("should let user create an even bet", async () => {
            await roulette.createBet(user1, 1, 1, 0, 1000);
        });

        it("should emit NewEvenOddBet event", async () => {
            await roulette.createBet(user1, 1, 1, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewEvenOddBet", roulette);
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 1, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 1);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 1);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 1, 1, 0, 1000);
            const userBet = await roulette.bets(0);
            const res = await roulette.getBetsCountAndValue();
            assert.equal(res["1"], 1000);

            assert.equal(user1, userBet.player);
            assert.equal(1, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 1);
        });
    });

    describe("Betting: Odd", () => {
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
        });

        it("should let user create an odd bet", async () => {
            await roulette.createBet(user1, 1, 2, 0, 1000);
        });

        it("should emit NewEvenOddBet event", async () => {
            await roulette.createBet(user1, 1, 2, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewEvenOddBet", roulette);
            // check all values of event;
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 1, 2, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 2);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 1);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 1, 2, 0, 1000);
            const userBet = await roulette.bets(0);
            const res = await roulette.getBetsCountAndValue();
            assert.equal(res["1"], 1000);

            assert.equal(user1, userBet.player);
            assert.equal(2, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 1);
        });
    });

    describe("Betting: Red", () => {
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
        });

        it("should let user create a red bet", async () => {
            await roulette.createBet(user1, 2, 1, 0, 1000);
        });

        it("should emit NewRedBlackBet event", async () => {
            await roulette.createBet(user1, 2, 1, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewRedBlackBet", roulette);
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 2, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 1);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 2);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 2, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(user1, userBet.player);
            assert.equal(1, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 2);
        });
    });

    describe("Betting: Black", () => {
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
        });

        it("should let user create a black bet", async () => {
            await roulette.createBet(user1, 2, 2, 0, 1000);
        });

        it("should emit NewRedBlackBet event", async () => {
            await roulette.createBet(user1, 2, 2, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewRedBlackBet", roulette);
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 2, 2, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 2);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 2);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 2, 2, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(user1, userBet.player);
            assert.equal(2, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 2);
        });
    });

    describe("Betting: High", () => {
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
        });

        it("should let user create a High bet", async () => {
            await roulette.createBet(user1, 3, 1, 0, 1000);
        });

        it("should emit NewHighLowBet event", async () => {
            await roulette.createBet(user1, 3, 1, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewHighLowBet", roulette);
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 3, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 1);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 3);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 3, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(user1, userBet.player);
            assert.equal(1, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 3);
        });
    });

    describe("Betting: Low", () => {
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
        });

        it("should let user create a Low bet", async () => {
            await roulette.createBet(user1, 3, 2, 0, 1000);
        });

        it("should emit NewHighLowBet event", async () => {
            await roulette.createBet(user1, 3, 2, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewHighLowBet", roulette);
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 3, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 1);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 3);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 3, 2, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(user1, userBet.player);
            assert.equal(2, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 3);
        });
    });

    describe("Betting: Column", () => {
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
        });

        it("should emit NewColumnBet event", async () => {
            await roulette.createBet(user1, 4, 2, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewColumnBet", roulette);
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 4, 2, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 2);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 4);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 4, 2, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(user1, userBet.player);
            assert.equal(2, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 4);
        });
    });

    describe("Betting: Dozen", () => {
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
        });

        it("should emit NewDozenBet event", async () => {
            await roulette.createBet(user1, 5, 2, 0, 1000);
            const res = await roulette.getBetsCountAndValue();
            assert(res[0], 1);
            assert(res[1], 1000);
            // const event = await getLastEvent("NewDozenBet", roulette);
            // assert(event);
        });

        it("should store bet in array", async () => {
            await roulette.createBet(user1, 5, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(userBet.player, user1);
            assert.equal(userBet.number.toNumber(), 1);
            assert.equal(userBet.value.toNumber(), 1000);
            assert.equal(userBet.betType.toNumber(), 5);
        });
        it("event values should be the same as array", async () => {
            await roulette.createBet(user1, 5, 1, 0, 1000);
            const userBet = await roulette.bets(0);

            assert.equal(user1, userBet.player);
            assert.equal(1, userBet.number.toNumber());
            assert.equal(1000, userBet.value.toNumber());
            assert.equal(userBet.betType.toNumber(), 5);

            /*const { bet, player, value, dozen } = await getLastEvent(
                "NewDozenBet",
                roulette
            );

            const res = await roulette.getBetsCountAndValue();
            assert.equal(res["0"], bet);
            assert.equal(player, userBet.player);
            assert.equal(dozen, userBet.number);
            assert.equal(value, userBet.value.toNumber());*/
        });
    });

    describe("Betting: Launch", () => {
        before(async () => {
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
        });

        it("should revert if current time is not greater than next round timestamp", async () => {
            const localHash =
                "0x2540a8d1ecac31d69ad55354fba8289cfbb61adac332291b1fe0a8c1011f1a2f";
            await catchRevert(
                roulette.launch(localHash),//,// 1, 2, "MANA"),
                "revert expired round"
            );
        });

        it("should revert if there are no bets", async () => {
            await advanceTimeAndBlock(60);

            const localHash =
                "0x2540a8d1ecac31d69ad55354fba8289cfbb61adac332291b1fe0a8c1011f1a2f";
            await catchRevert(
                roulette.launch(localHash),//, 1, 2, "MANA"),
                "revert must have bets"
            );
        });

        it("should create different bets", async () => {
            await roulette.createBet(user1, 0, 5, 0, 1000);
            await roulette.createBet(user1, 1, 0, 0, 1000);
            await roulette.createBet(user1, 1, 1, 0, 1000);
            await roulette.createBet(user1, 2, 0, 0, 1000);
            await roulette.createBet(user2, 2, 1, 0, 1000);
            await roulette.createBet(user2, 3, 0, 0, 1000);
            await roulette.createBet(user2, 3, 1, 0, 1000);
            await roulette.createBet(user2, 4, 2, 0, 1000);
            await roulette.createBet(user2, 5, 1, 0, 1000);
        });

        it("correct bet amount and value", async () => {
            const res = await roulette.getBetsCountAndValue();
            assert.equal(res["0"], 9);
            assert.equal(res["1"], 9000);
        });

        it("correct bet square values", async () => {

            await roulette.createBet(user1, 0, 5, 0, 1000);
            await roulette.createBet(user2, 4, 2, 0,2000);
            await roulette.createBet(user2, 5, 1, 0,3000);

            const resA = await roulette.currentBets(0, 0, 5);
            assert.equal(resA.toNumber(), 2000);
            const resB = await roulette.currentBets(0, 4, 2);
            assert.equal(resB.toNumber(), 3000);
            const resC = await roulette.currentBets(0, 5, 1);
            assert.equal(resC.toNumber(), 4000);
        });

        it("correct bet square values limits", async () => {
            await roulette.createBet(user1, 0, 6, 0, 4000);
            const resA = await roulette.currentBets(0, 0, 6);
            assert.equal(resA.toNumber(), 4000);
        });

        it("should revert if exceeding square limit 4001", async () => {
            await advanceTimeAndBlock(60);
            await catchRevert(
                roulette.createBet(user1, 0, 6, 0,4001),
                "revert exceeding maximum bet square limit"
            );
        });

        it("should revert if exceeding square limit 5000", async () => {
            await advanceTimeAndBlock(60);
            await roulette.createBet(user1, 0, 7, 0,2000);
            await advanceTimeAndBlock(60);
            await catchRevert(
                roulette.createBet(user1, 0, 7, 0,3000),
                "revert exceeding maximum bet square limit"
            );
        });

        it("should cleanup squares after the play", async () => {
            //create contract
            const rouletteB = await Roulette.new(owner, 4000, 36);
            const localHash =
                "0x2540a8d1ecac31d69ad55354fba8289cfbb61adac332291b1fe0a8c1011f1a2f";

            //create bets
            await rouletteB.createBet(user2, 0, 5, 0, 1000);
            await rouletteB.createBet(user2, 4, 2, 0, 1000);
            await rouletteB.createBet(user2, 5, 1, 0, 1000);

            //check squares before the play
            const resA = await rouletteB.currentBets(0, 0, 5);
            assert.equal(resA.toNumber(), 1000);
            const resB = await rouletteB.currentBets(0, 4, 2);
            assert.equal(resB.toNumber(), 1000);
            const resC = await rouletteB.currentBets(0, 5, 1);
            assert.equal(resC.toNumber(), 1000);

            //launch play
            await advanceTimeAndBlock(60);
            await rouletteB.launch(localHash);//, 1, 2, "MANA");
            await advanceTimeAndBlock(60);

            //check squares after play
            const resD = await rouletteB.currentBets(0, 0, 5);
            assert.equal(resD.toNumber(), 0);
            const resE = await rouletteB.currentBets(0, 4, 2);
            assert.equal(resE.toNumber(), 0);
            const resF = await rouletteB.currentBets(0, 5, 1);
            assert.equal(resF.toNumber(), 0);

        });

        it("should only allow worker to call external functions", async () => {
            await advanceTimeAndBlock(60);
            const rouletteA = await Roulette.new(user1, 4000, 36);
            await advanceTimeAndBlock(60);
            await catchRevert(
                rouletteA.createBet(user1, 0, 34,0, 1000, { from: user1 }),
                "revert can only be called by master/parent contract"
            );
        });

        it("should be able to launch game", async () => {
            await advanceTimeAndBlock(60);

            const localHash =
                "0x2540a8d1ecac31d69ad55354fba8289cfbb61adac332291b1fe0a8c1011f1a2f";
            const res = await roulette.launch(localHash);//, 1, 2, "MANA");
            console.log(res);
        });

        it("should be able to change MaxSquareBetDefault", async () => {
            const current = await roulette.checkMaxSquareBetDefault();
            assert.equal(current, 4000);
            await roulette.changeMaxSquareBetDefault(8000);
            const newValue = await roulette.checkMaxSquareBetDefault();
            assert.equal(newValue.toNumber(), 8000);
        });

        it("should be able to change MaxSquareBetDefault and maintain store", async () => {
            const current = await roulette.checkMaxSquareBetDefault();
            const currentBet = await roulette.checkMaximumBetAmount();
            assert.equal(current.toNumber(), 8000);
            assert.equal(currentBet.toNumber(), 36);
            await roulette.changeMaxSquareBetDefault(12000);
            const newValue = await roulette.checkMaxSquareBetDefault();
            const currentBetNew = await roulette.checkMaximumBetAmount();
            assert.equal(newValue.toNumber(), 12000);
            assert.equal(currentBetNew.toNumber(), 36);
        });

        it("should be able to change MaximumBetAmount", async () => {
            const current = await roulette.checkMaximumBetAmount();
            assert.equal(current, 36);
            await roulette.changeMaximumBetAmount(28);
            const newValue = await roulette.checkMaximumBetAmount();
            assert.equal(newValue.toNumber(), 28);
        });

        it("should be able to change MaximumBetAmount and maintain store", async () => {
            const current = await roulette.checkMaximumBetAmount();
            const currentBet = await roulette.checkMaxSquareBetDefault();
            assert.equal(current.toNumber(), 28);
            assert.equal(currentBet.toNumber(), 12000);
            await roulette.changeMaximumBetAmount(32);
            const newValue = await roulette.checkMaximumBetAmount();
            const currentBetNew = await roulette.checkMaxSquareBetDefault();
            assert.equal(newValue.toNumber(), 32);
            assert.equal(currentBetNew.toNumber(), 12000);
        });
    });
});
