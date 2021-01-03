const Token = artifacts.require("dgToken");
const Pointer = artifacts.require("dgPointer");
const Backgammon = artifacts.require("dgBackgammon");
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

contract("dgPointer", ([owner, user1, user2, user3, random]) => {

    before(async () => {
        token = await Token.new();
        pointer = await Pointer.new(token.address, name, version);

        pointer.declareContract(owner);
    });

    describe("Game Results: Backgammon", () => {

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            treasury = await Treasury.new(token.address, "MANA");
            backgammon = await Backgammon.new(treasury.address, 1, 10, pointer.address);
            await pointer.declareContract(owner);
            await pointer.declareContract(backgammon.address);
            await treasury.addGame(backgammon.address, "Backgammon", true, { from: owner });
            await treasury.setMaximumBet(0, 0, 1000, { from: owner });
            await token.approve(treasury.address, web3.utils.toWei("100"));
            await treasury.addFunds(0, 0, web3.utils.toWei("100"), {
                from: owner
            });
            await token.transfer(user1, 10000);
            await token.transfer(user2, 10000);
            await token.transfer(user3, 10000);
            await token.transfer(random, 10000);
            await token.approve(treasury.address, 5000, { from: user1 });
            await token.approve(treasury.address, 5000, { from: user2 });
            await token.approve(treasury.address, 5000, { from: user3 });
            await token.approve(treasury.address, 5000, { from: random });
            await treasury.setTail(HASH_CHAIN[0], { from: owner });

            const ratio = 10;

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.setPointToTokenRatio(token.address, backgammon.address, ratio);

            secondpointer = await Pointer.new(token.address, secondName, secondVersion);
            await secondpointer.declareContract(owner);
            await secondpointer.declareContract(backgammon.address);

            await secondpointer.enableDistribtion(true);
            await secondpointer.enableCollecting(true);
            await secondpointer.setPointToTokenRatio(token.address, backgammon.address, ratio);

        });

        it("should ONLY allow CEO to update Pointer for backgammon", async () => {

            await catchRevert(
                backgammon.updatePointer(
                    secondpointer.address,
                    { from: random }
                ),
                'revert AccessControl: CEO access denied'
            );

            await backgammon.updatePointer(secondpointer.address, { from: owner });
        });

        it("should NOT add points after intitializing a game of backgammon", async () => {

            const defaultStake = 100;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(
                user1PointsBefore.toString(),
                0
            );

            assert.equal(
                user2PointsBefore.toString(),
                0
            );

            assert.equal(
                user1PointsAfter.toString(),
                0
            );

            assert.equal(
                user2PointsAfter.toString(),
                0
            );
        });


        it("should record new points for backgammon after updating Pointer", async () => {

            const defaultStake = 100;
            const ratio = 10;

            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );


            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);
            await backgammon.resolveGame(
                _gameID,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user1PointsAfter.toString(), 2);
            assert.equal(user2PointsAfter.toString(), 2);


            await backgammon.updatePointer(secondpointer.address, { from: owner });
           // await newpointer.setPointToTokenRatio(secondtoken.address, backgammon.address, ratio);

            const resultNewPointerBeforePlayUser1 = await secondpointer.pointsBalancer(user1);
            const resultNewPointerBeforePlayUser2 = await secondpointer.pointsBalancer(user2);

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const _gameIDtwo = await backgammon.getGameIdOfPlayers(user1, user2);
            await backgammon.resolveGame(
                _gameIDtwo,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const resultNewPointerAfterResolveUser1 = await secondpointer.pointsBalancer(user1);
            const resultNewPointerAfterResolveUser2 = await secondpointer.pointsBalancer(user2);

            assert.equal(
                resultNewPointerBeforePlayUser1,
                0
            );

            assert.equal(
                resultNewPointerBeforePlayUser2,
                0
            );

            assert.equal(
                resultNewPointerAfterResolveUser1.toString(),
                2
            );

            assert.equal(
                resultNewPointerAfterResolveUser2.toString(),
                2
            );
        });

        it("should not update old pointsbalancer after updating Pointer", async () => {

            const defaultStake = 100;
            const ratio = 10;
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);


            assert.equal(
                user1PointsBefore.toString(),
                0
            );

            assert.equal(
                user2PointsBefore.toString(),
                0
            );

            await backgammon.updatePointer(
                secondpointer.address,
                { from: owner }
            );

            const resultNewPointerBeforePlayUser1 = await secondpointer.pointsBalancer(user1);
            const resultNewPointerBeforePlayUser2 = await secondpointer.pointsBalancer(user2);

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);
            await backgammon.resolveGame(
                _gameID,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const resultNewPointerAfterPlayUser1 = await secondpointer.pointsBalancer(user1);
            const resultNewPointerAfterPlayUser2 = await secondpointer.pointsBalancer(user2);
            const origPointerResultAfterPlayUser1 = await pointer.pointsBalancer(user1);
            const origPointerResultAfterPlayUser2 = await pointer.pointsBalancer(user2);

            assert.equal(resultNewPointerBeforePlayUser1, 0);
            assert.equal(resultNewPointerBeforePlayUser2, 0);
            assert.equal(resultNewPointerAfterPlayUser1.toString(), 2);
            assert.equal(resultNewPointerAfterPlayUser2.toString(), 2);
            assert.equal(origPointerResultAfterPlayUser1.toString(), 0);
            assert.equal(origPointerResultAfterPlayUser2.toString(), 0);
        });

        it("should NOT addpoints for raising Player from raiseDouble()", async () => {

            const ratio = 10;
            const defaultStake = 100;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);

            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
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
            assert.equal(stake, defaultStake * 3);

            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user1PointsAfter.toString(), 0);
            assert.equal(user2PointsAfter.toString(), 0);
        });

        it("should NOT add points after callDouble() of backgammon for calling Player only", async () => {

            const ratio = 10;
            const defaultStake = 100;
            const totalRaisedStake = defaultStake * 2;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);

            await backgammon.raiseDouble(
                _gameID,
                user1,
                { from: owner }
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
            assert.equal(totalStaked, defaultStake * 4);

            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user1PointsAfter.toString(), 0);
            assert.equal(user2PointsAfter.toString(), 0);

        });


        it("should DOUBLE add points after resolveGame() and callDouble() for both players", async () => {

            const ratio = 10;
            const defaultStake = 100;
            const totalRaisedStake = defaultStake * 2;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);

            await backgammon.raiseDouble(
                _gameID,
                user1,
                { from: owner }
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
            assert.equal(totalStaked, defaultStake * 4);

            await backgammon.resolveGame(
                _gameID,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user1PointsAfter.toString(), 4);
            assert.equal(user2PointsAfter.toString(), 4);

        });



        it("should only give wearable bonus to a player that has a wearable", async () => {
            const ratio = 10;
            const defaultStake = 1000;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);
            const playerOneWearableBonus = 1;
            const playerTwoWearableBonus = 0;

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);
            await backgammon.resolveGame(
                _gameID,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );
            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user1PointsAfter.toString(), (10 + ((10*playerOneWearableBonus)/ratio))*2);
            assert.equal(user2PointsAfter.toString(), 20);

        });

        it("should earn points from raiseDouble if user2 drops the game without calling", async () => {

            const ratio = 10;
            const defaultStake = 100;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);
            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;


            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(user1, user2);

            await backgammon.raiseDouble(
                _gameID,
                user1,
                { from: owner }
            );

            await backgammon.dropGame(
                _gameID,
                user2,
                playerOneWearableBonus,
                playerTwoWearableBonus,
                { from: owner }
            );

            const { gameId, player} = await getLastEvent(
                "PlayerDropped",
                backgammon
            );

            assert.equal(gameId, _gameID);
            assert.equal(player, user2);

            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user1PointsAfter.toString(), 3);
            assert.equal(user2PointsAfter.toString(), 3);

        });


        it("should addpoints if resolving multiple games", async () => {

            const ratio = 10;
            const defaultStake = 100;
            const totalpointsFromInits = defaultStake * 3;

            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);
            const user3PointsBefore = await pointer.pointsBalancer(user3);
            const randomPointsBefore = await pointer.pointsBalancer(random);

            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user3,
                0,
                { from: owner }
            );

            await backgammon.initializeGame(
                defaultStake,
                user1,
                random,
                0,
                { from: owner }
            );


            const _gameID1 = await backgammon.getGameIdOfPlayers(user1, user2);
            await backgammon.resolveGame(
                _gameID1,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const _gameID2 = await backgammon.getGameIdOfPlayers(user1, user3);
            await backgammon.resolveGame(
                _gameID2,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const _gameID3 = await backgammon.getGameIdOfPlayers(user1, random);
            await backgammon.resolveGame(
                _gameID3,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );


            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);
            const user3PointsAfter = await pointer.pointsBalancer(user3);
            const randomPointsAfter = await pointer.pointsBalancer(random);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user3PointsBefore.toString(), 0);
            assert.equal(randomPointsBefore.toString(), 0);

            assert.equal(user1PointsAfter.toString(), 6);
            assert.equal(user2PointsAfter.toString(), 2);
            assert.equal(user3PointsAfter.toString(), 2);
            assert.equal(randomPointsAfter.toString(), 2);
        });

        it("should 2x addpoints if resolving multiple games that were doubled", async () => {

            const ratio = 10;
            const defaultStake = 100;

            const singleGameDoubledStake = defaultStake * 2;
            const totalpointsFromInits = defaultStake * 3;
            const doubledTotalPoints = totalpointsFromInits * 2;


            const user1PointsBefore = await pointer.pointsBalancer(user1);
            const user2PointsBefore = await pointer.pointsBalancer(user2);
            const user3PointsBefore = await pointer.pointsBalancer(user3);
            const randomPointsBefore = await pointer.pointsBalancer(random);

            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            await backgammon.initializeGame(
                defaultStake,
                user1,
                user3,
                0,
                { from: owner }
            );

            await backgammon.initializeGame(
                defaultStake,
                user1,
                random,
                0,
                { from: owner }
            );

            const _gameID1 = await backgammon.getGameIdOfPlayers(user1, user2);
            const _gameID2 = await backgammon.getGameIdOfPlayers(user1, user3);
            const _gameID3 = await backgammon.getGameIdOfPlayers(user1, random);


            await backgammon.raiseDouble(
                _gameID1,
                user1,
                { from: owner }
            );
            await backgammon.raiseDouble(
                _gameID2,
                user1,
                { from: owner }
            );
            await backgammon.raiseDouble(
                _gameID3,
                user1,
                { from: owner }
            );


            await backgammon.callDouble(
                _gameID1,
                user2,
                { from: owner }
            );
            await backgammon.callDouble(
                _gameID2,
                user3,
                { from: owner }
            );
            await backgammon.callDouble(
                _gameID3,
                random,
                { from: owner }
            );

            await backgammon.resolveGame(
                _gameID1,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            await backgammon.resolveGame(
                _gameID2,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            await backgammon.resolveGame(
                _gameID3,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const user1PointsAfter = await pointer.pointsBalancer(user1);
            const user2PointsAfter = await pointer.pointsBalancer(user2);
            const user3PointsAfter = await pointer.pointsBalancer(user3);
            const randomPointsAfter = await pointer.pointsBalancer(random);

            assert.equal(user1PointsBefore.toString(), 0);
            assert.equal(user2PointsBefore.toString(), 0);
            assert.equal(user3PointsBefore.toString(), 0);
            assert.equal(randomPointsBefore.toString(), 0);

            assert.equal(user1PointsAfter.toString(), 12);
            assert.equal(user2PointsAfter.toString(), 4);
            assert.equal(user3PointsAfter.toString(), 4);
            assert.equal(randomPointsAfter.toString(), 4);
        });
    });
});
