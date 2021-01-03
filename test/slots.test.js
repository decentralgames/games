const Token = artifacts.require("dgToken");
const Pointer = artifacts.require("dgPointer");
const Slots = artifacts.require("dgSlots");
const Treasury = artifacts.require("dgTreasury");
const catchRevert = require("./exceptionsHelpers.js").catchRevert;
const positions = [0, 16, 32, 48];
const name = "name";
const version = "0";
const secondName = "newName";
const secondVersion = "1";

require("./utils");

const getLastEvent = async (eventName, instance) => {
    const events = await instance.getPastEvents(eventName, {
        fromBlock: 0,
        toBlock: "latest"
    });

    return events.pop().returnValues;
};

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

contract("dgSlots", ([owner, newCEO, user1, user2, random]) => {
    let slots;

    before(async () => {
        token = await Token.new();
        pointer = await Pointer.new(token.address, name, version);
        slots = await Slots.new(owner, 250, 15, 8, 4, pointer.address, {from: owner});
    });

    describe("Initial Variables", () => {
        it("correct worker address", async () => {
            const worker = await slots.workerAddress();
            assert.equal(worker, owner);
        });

        it("correct factor1 value", async () => {
            const factor = await slots.getPayoutFactor(positions[0]);
            assert.equal(factor, 250);
        });

        it("correct factor2 value", async () => {
            const factor = await slots.getPayoutFactor(positions[1]);
            assert.equal(factor, 15);
        });

        it("correct factor3 value", async () => {
            const factor = await slots.getPayoutFactor(positions[2]);
            assert.equal(factor, 8);
        });

        it("correct factor4 value", async () => {
            const factor = await slots.getPayoutFactor(positions[3]);
            assert.equal(factor, 4);
        });

        it("contract must be unpaused initially", async () => {
            const paused = await slots.paused();
            assert.equal(paused, false);
        });
    });

    describe("Access Control", () => {
        it("correct CEO address", async () => {
            const ceo = await slots.ceoAddress();
            assert.equal(ceo, owner);

            const event = await getLastEvent("CEOSet", slots);
            assert.equal(event.newCEO, owner);
        });

        it("only CEO can set a new CEO Address", async () => {
            await catchRevert(slots.setCEO(newCEO, { from: random }));
            await slots.setCEO(newCEO, { from: owner });

            const event = await getLastEvent("CEOSet", slots);
            assert.equal(event.newCEO, newCEO);
        });

        it("only CEO can set a new worker Address", async () => {
            await catchRevert(slots.setWorker(user1, { from: random }));
            await slots.setWorker(user1, { from: owner });

            const event = await getLastEvent("WorkerSet", slots);
            assert.equal(event.newWorker, user1);
        });

        it("only Worker can pause the contract", async () => {
            await catchRevert(slots.pause({ from: random }));
            await slots.pause({ from: user1 });

            const event = await getLastEvent("Paused", slots);
            assert(event);

            const paused = await slots.paused();
            assert.equal(paused, true);
        });

        it("only CEO can unpause the contract", async () => {
            await catchRevert(slots.unpause({ from: random }));
            await slots.unpause({ from: newCEO });

            const event = await getLastEvent("Unpaused", slots);
            assert(event);

            const paused = await slots.paused();
            assert.equal(paused, false);
        });

        it("only CEO can set new factors", async () => {
            await catchRevert(slots.updateFactors(1, 2, 3, 4, { from: random }));

            let factor = await slots.getPayoutFactor(positions[0]);
            assert.equal(factor.toNumber(), 250);

            factor = await slots.getPayoutFactor(positions[1]);
            assert.equal(factor.toNumber(), 15);

            factor = await slots.getPayoutFactor(positions[2]);
            assert.equal(factor.toNumber(), 8);

            factor = await slots.getPayoutFactor(positions[3]);
            assert.equal(factor.toNumber(), 4);

            await slots.updateFactors(500, 100, 50, 25, { from: newCEO });

            factor = await slots.getPayoutFactor(positions[0]);
            assert.equal(factor.toNumber(), 500);

            factor = await slots.getPayoutFactor(positions[1]);
            assert.equal(factor.toNumber(), 100);

            factor = await slots.getPayoutFactor(positions[2]);
            assert.equal(factor.toNumber(), 50);

            factor = await slots.getPayoutFactor(positions[3]);
            assert.equal(factor.toNumber(), 25);
        });

        it("only CEO can set new treasury", async () => {
            await catchRevert(slots.updateTreasury(user2, { from: random }));
            await slots.updateTreasury(user2, { from: newCEO });
            const treasury = await slots.treasury();
            assert.equal(treasury, user2);
        });
    });

    describe("Game Play", () => {
        it("correct necessary balance calculation", async () => {
            const betA = 100;
            let factor = await slots.getPayoutFactor(positions[0]);
            let payout = await slots.getMaxPayout(betA);
            assert.equal(factor.toNumber() * betA, payout.toNumber());
        });
    });
});



contract("dgPointer", ([owner, user1, user2, user3, random]) => {
    let slots;
    before(async () => {
        token = await Token.new();
        pointer = await Pointer.new(token.address, name, version);
        slots = await Slots.new(
            owner,
            250,
            15,
            8,
            4,
            pointer.address,
            {from: owner}
        );
        pointer.declareContract(owner);
    });

    describe("dgPointer Slots: Game Results", () => {

        beforeEach(async () => {
            token = await Token.new();

            pointer = await Pointer.new(
                token.address,
                name,
                version
            );

            treasury = await Treasury.new(
                token.address,
                "MANA"
            );

            slots = await Slots.new(
                treasury.address,
                250,
                16,
                8,
                4,
                pointer.address
            );

            pointer.declareContract(owner);
            pointer.declareContract(slots.address);

            await treasury.addGame(
                slots.address,
                "Slots",
                true,
                { from: owner }
            );

            await treasury.setMaximumBet(
                0,
                0,
                1000,
                { from: owner }
            );

            await token.approve(
                treasury.address,
                web3.utils.toWei("100")
            );

            await treasury.addFunds(
                0,
                0,
                web3.utils.toWei("100"),
                {from: owner}
            );

            await token.transfer(
                user1,
                10000
            );

            await token.transfer(
                user2,
                10000
            );

            await token.approve(
                treasury.address,
                5000,
                { from: user1 }
            );

            await token.approve(
                treasury.address,
                5000,
                { from: user2 }
            );

            await treasury.setTail(
                HASH_CHAIN[0],
                { from: owner }
            );

            secondtoken = await Token.new();

            newpointer = await Pointer.new(
                secondtoken.address,
                secondName,
                secondVersion
            );

            await newpointer.declareContract(owner);
            await newpointer.declareContract(slots.address);
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

        it("should addPoints when playing slots", async () => {

            const ratio = 100;
            const betAmount = 1000;

            const resultBefore = await pointer.pointsBalancer(user1);

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.setPointToTokenRatio(
                token.address,
                slots.address,
                ratio
            );

            await advanceTimeAndBlock(60);
            await slots.play(
                user1,
                1,
                2,
                betAmount,
                HASH_CHAIN[1],
                0,
                0,
                { from: owner }
            );

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfter > 0 ,
                true
            );

            assert.equal(
                resultAfter.toString(),
                betAmount / ratio
            );
        });

        it("should addPoints when playing slots continuously", async () => {

            const ratio = 200;
            const betAmount = 1000;

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.setPointToTokenRatio(
                token.address,
                slots.address,
                ratio
            );

            let beforeBetUser,
                afterBetUser,
                totalBet = 0,
                winTotal = 0;

            beforeBetUser = await token.balanceOf(user2);
            pointsBefore = await pointer.pointsBalancer(user2);

            for (let i = 0; i < 5; i++) {
                totalBet += betAmount;
                await advanceTimeAndBlock(60);
                await slots.play(
                    user2,
                    1,
                    12,
                    betAmount,
                    HASH_CHAIN[i + 1],
                    0,
                    0,
                    { from: owner }
                );

                const { _winAmount } = await getLastEvent("GameResult", slots);

                console.log(
                    `     Play ${i + 1}: WinAmount:[${_winAmount}]`.cyan.inverse
                );

                let pointsAfter = await pointer.pointsBalancer(user2);

                console.log(
                    `     Play ${i + 1}: Points:[${pointsAfter}]`.cyan.inverse
                );

                if (_winAmount > 0) {
                    winTotal = _winAmount;
                }
            }

            afterBetUser = await token.balanceOf(user2);
            pointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(
                afterBetUser.toNumber(),
                beforeBetUser.toNumber() + Number(winTotal) - totalBet
            );

            assert.equal(
                pointsBefore,
                0
            );

            assert.equal(
                pointsAfter > 0,
                true
            );

            assert.equal(
                pointsAfter.toString(),
                totalBet / ratio
            );
        });

        it("should addPoints when playing slots continuously (with wearables)", async () => {

            const ratio = 200;
            const betAmount = 1000;

            const wearableCount = 4;
            const wearableBonus = 0.1;

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.setPointToTokenRatio(
                token.address,
                slots.address,
                ratio
            );

            let beforeBetUser,
                afterBetUser,
                totalBet = 0,
                winTotal = 0;

            beforeBetUser = await token.balanceOf(user2);
            pointsBefore = await pointer.pointsBalancer(user2);

            for (let i = 0; i < 5; i++) {
                totalBet += betAmount;
                await advanceTimeAndBlock(60);
                await slots.play(
                    user2,  // _player
                    1,      // _landID
                    12,     // _machineID
                    betAmount,
                    HASH_CHAIN[i + 1],
                    0, // _tokenIndex
                    wearableCount,
                    { from: owner }
                );

                const { _winAmount } = await getLastEvent("GameResult", slots);

                console.log(
                    `     Play ${i + 1}: WinAmount:[${_winAmount}]`.cyan.inverse
                );

                let pointsAfterWithBonus = await pointer.pointsBalancer(user2);

                console.log(
                    `     Play ${i + 1}: PointsWithBonus:[${pointsAfterWithBonus}]`.cyan.inverse
                );

                if (_winAmount > 0) {
                    winTotal = _winAmount;
                }
            }

            pointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(
                pointsAfter.toString(),
                (totalBet + (totalBet * wearableCount * wearableBonus)) / ratio
            );
        });

        it("should ONLY allow CEO to update Pointer for slots", async () => {

            await catchRevert(
                slots.updatePointer(
                    newpointer.address,
                    { from: random }
                ),
                'revert AccessControl: CEO access denied'
            );

            await slots.updatePointer(
                newpointer.address,
                { from: owner }
            );
        });

        it("should record new points for slots after updating Pointer", async () => {

            const ratio = 100;
            const betAmount = 1000;

            const resultinit = await pointer.pointsBalancer(user1);

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.setPointToTokenRatio(
                token.address,
                slots.address,
                ratio
            );

            await advanceTimeAndBlock(60);
            await slots.play(
                user1,
                1,
                2,
                betAmount,
                HASH_CHAIN[1],
                0,
                0,
                { from: owner }
            );

            const resultAfterPlay = await pointer.pointsBalancer(user1);

            assert.equal(
                resultinit,
                0
            );

            assert.equal(
                resultAfterPlay.toString(),
                betAmount / ratio
            );

            await slots.updatePointer(
                newpointer.address,
                { from: owner }
            );

            const resultNewPointerBeforePlay = await newpointer.pointsBalancer(user1);

            await newpointer.enableDistribtion(true);
            await newpointer.enableCollecting(true);

            await newpointer.setPointToTokenRatio(
                token.address,
                slots.address,
                ratio
            );

            await advanceTimeAndBlock(60);
            await slots.play(
                user1,
                1,
                2,
                betAmount,
                HASH_CHAIN[2],
                0,
                0,
                { from: owner }
            );

            const resultNewPointerAfterPlay = await newpointer.pointsBalancer(user1);

            assert.equal(
                resultNewPointerBeforePlay,
                0
            );

            assert.equal(
                resultNewPointerAfterPlay.toString(),
                betAmount / ratio
            );
        });
    });
});