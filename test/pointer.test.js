const Token = artifacts.require("dgToken");
const Pointer = artifacts.require("dgPointer");
const Slots = artifacts.require("dgSlots");
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
    let slots;
    let secondslots;
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

    describe("Initial Variables", () => {

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
            slots = await Slots.new(
                owner,
                250,
                15,
                8,
                4,
                pointer.address,
                {from: owner}
            );
        });

        it("should have correct distributionToken address", async () => {

            const distributionToken = await pointer.distributionToken();

            assert.equal(
                distributionToken,
                token.address
            );
        });

        it("should allow to declare contract", async () => {

            const resultBeforeDeclare = await pointer.declaredContracts(
                slots.address
            );

            await pointer.declareContract(
                slots.address
            );

            const resultAfterDeclare = await pointer.declaredContracts(
                slots.address
            );

            assert.equal(
                resultBeforeDeclare,
                false
            );

            assert.equal(
                resultAfterDeclare,
                true
            );
        });

        it("should allow to set tokenToPointsRatio", async () => {

            const resultBefore = await pointer.tokenToPointRatio(
                owner,
                token.address
            );

            await pointer.setTokenToPointRatio(
                owner,
                token.address,
                150
            );

            const resultAfter = await pointer.tokenToPointRatio(
                owner,
                token.address
            );

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfter,
                150
            );
        });

        it("should NOT allow to set points from undeclared address", async () => {

            const ratio = 150;
            const points = 15000;

            const resultBefore = await pointer.pointsBalancer(user1);

            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);

            await pointer.setTokenToPointRatio(
                owner,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address,
                1,
                0,
                {from: user1}
            );

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfter,
                0
            );
        });

        it("should allow to set points from declared address", async () => {

            const ratio = 150;
            const points = 15000;

            // check is 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);

            // declare contract
            await pointer.declareContract(user2);

            // set token to point ratio
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );

            // add points
            await pointer.addPoints(
                user1,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            const resultAfterDefault = await pointer.pointsBalancer(user1);

            // disable collecting
            await pointer.enableCollecting(false);

            // add points again
            await pointer.addPoints(
                user2,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            const resultAfterDisabled = await pointer.pointsBalancer(user2);

            // enable collecting
            await pointer.enableCollecting(true);

            await pointer.addPoints(
                random,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            const resultAfterEnabled = await pointer.pointsBalancer(random);

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfterDefault,
                0
            );

            assert.equal(
                resultAfterDisabled,
                0
            );

            assert.equal(
                resultAfterEnabled,
                points / ratio
            );
        });

        it("should block distributionToken if bool is false", async () => {

            const ratio = 150;
            const points = 15000;

            //check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);

            // collectingEnabled = true,
            // dsitributionEnabled = false
            await pointer.enableCollecting(true);
            await pointer.enableDistribtion(false);

            // declare contract
            await pointer.declareContract(user2);

            // set ratio for user2
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            await catchRevert(
                pointer.distributeTokens(
                    user1
                ),
                'revert Pointer: distribution disabled'
            );

        });

        it("should ONLY allow worker to assign affiliate", async () => {

            const affiliatedUser = user1;
            const affiliatingUser = user2;
            const workerUser = owner;

            await catchRevert(
                pointer.assignAffiliate(
                    affiliatedUser,
                    affiliatingUser,
                    { from: random }
                ),
                'revert AccessControl: worker access denied'
            );

            await pointer.setWorker(
                workerUser,
                { from: owner }
            );

            const event = await getLastEvent(
                'WorkerSet',
                pointer
            );

            assert.equal(
                event.newWorker,
                workerUser
            );

            await pointer.assignAffiliate(
                affiliatedUser,
                affiliatingUser,
                { from: workerUser }
            );

            const affiliateAddress = await pointer.affiliateData(
                affiliatingUser
            );

            assert.equal(
                affiliateAddress,
                affiliatedUser
            );
        });

        it("should ONLY allow CEO to change distributionToken address", async () => {

            const distributionToken = await pointer.distributionToken();

            assert.equal(
                distributionToken,
                token.address
            );

            await catchRevert(
                pointer.changeDistributionToken(
                    token.address,
                    { from: random }
                ),
                'revert AccessControl: CEO access denied'
            );

            await pointer.changeDistributionToken(
                token.address,
                { from: owner }
            );
        });

        it("should block distributionToken if enableDistribtion is false", async () => {

            await token.transfer(
                pointer.address,
                100000
            );

            const event = await getLastEvent(
                "Transfer",
                token
            );

            assert.equal(
                event.to,
                pointer.address
            );

            assert.equal(
                event.value,
                100000
            );

            const ratio = 150;
            const points = 15000;

            const resultBefore = await pointer.pointsBalancer(user2);


            await pointer.enableDistribtion(false);
            await pointer.enableCollecting(true);

            await pointer.declareContract(user2);

            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            const resultAfter = await pointer.pointsBalancer(user1);

            await catchRevert(
                pointer.distributeTokens(
                    user1
                ),
                'revert Pointer: distribution disabled'
            );

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfter,
                points / ratio
            );
        });

        it("should ALLOW distributionToken if enableDistribtion is true", async () => {

            await token.transfer(
                pointer.address,
                100000
            );

            const event = await getLastEvent(
                "Transfer",
                token
            );

            assert.equal(
                event.to,
                pointer.address
            );

            assert.equal(
                event.value,
                100000
            );

            const ratio = 150;
            const points = 15000;

            const resultBefore = await pointer.pointsBalancer(user1);


            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.declareContract(user2);

            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            const resultBeforeDistributed = await pointer.pointsBalancer(user1);
            await pointer.distributeTokens(user1);
            const resultAfterDistributed = await pointer.pointsBalancer(user1);

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultBeforeDistributed,
                points / ratio
            );

            assert.equal(
                resultAfterDistributed,
                0
            );
        });
    });

    describe("dgPointer functions", () => {
        /*
            it("should allow assign affiliate to add points with NFT", async () => {
            });
        */
        //getWearableMultiplier
        //enable collecting = false, check points = 0
        //admin sets enablecollecting = true, check points = expected points for that game
        //distributionEnabled = false, check points = 0
        //admin sets distributionEnabled = true, check points = expected points for that game

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(token.address, name, version);
            pointer.declareContract(owner);
        });

        it("should ONLY allow CEO to change Player Bonus + event is generated", async () => {

            const twoplayerbonus = await pointer.playerBonuses(2);
            const threeplayerbonus = await pointer.playerBonuses(3);
            const fourplayerbonus = await pointer.playerBonuses(4);

            assert.equal(
                twoplayerbonus.toString(),
                10
            );

            assert.equal(
                threeplayerbonus.toString(),
                20
            );

            assert.equal(
                fourplayerbonus.toString(),
                30
            );

            await catchRevert(
                pointer.changePlayerBonus(
                    2,
                    20,
                    { from: random }
                ),
                'revert AccessControl: CEO access denied'
            );

            await pointer.changePlayerBonus(
                2,
                20,
                { from: owner }
            );

            //test event

            const event = await getLastEvent(
                "updatedPlayerBonus",
                pointer
            );

            assert.equal(
                event.playersCount,
                2
            );

            assert.equal(
                event.newBonus,
                20
            );

            const twoplayerbonusAfter = await pointer.playerBonuses(2);

            assert.equal(
                twoplayerbonusAfter.toString(),
                20
            );
        });

        it("should ONLY allow CEO to change affiliateBonus + event is generated", async () => {

            const defaultBonus = 10;
            const newBonus = 30;

            const affiliatebonusBefore = await pointer.affiliateBonus();
            assert.equal(affiliatebonusBefore.toString(), defaultBonus);

            await catchRevert(
                pointer.changeAffiliateBonus(
                    newBonus,
                    { from: random }
                ),
                'revert AccessControl: CEO access denied'
            );

            await pointer.changeAffiliateBonus(
                newBonus,
                { from: owner }
            );

            const affilEvent = await getLastEvent(
                'updatedAffiliateBonus',
                pointer
            );

            assert.equal(
                affilEvent.newBonus,
                newBonus
            );

            const affiliatebonusAfter = await pointer.affiliateBonus();

            assert.equal(
                affiliatebonusAfter.toString(),
                newBonus
            );

            const ratio = 150;
            const points = 15000;
            const bonus = 0.3;

            const affiliatedUser = user1;
            const affiliatingUser = user2;
            const workerUser = owner;

            // affiliate user
            await pointer.setWorker(
                workerUser,
                { from: owner }
            );

            const event = await getLastEvent(
                'WorkerSet',
                pointer
            );

            assert.equal(
                event.newWorker,
                workerUser
            );

            await pointer.assignAffiliate(
                affiliatedUser,
                affiliatingUser,
                { from: workerUser }
            );

            const affiliateAddress = await pointer.affiliateData(affiliatingUser);

            assert.equal(
                affiliateAddress,
                affiliatedUser
            );

            await pointer.enableCollecting(true);
            await pointer.enableDistribtion(true);

            await pointer.declareContract(user2);

            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );

            await pointer.addPoints(
                affiliatingUser,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            const affiliatingUserResult = await pointer.pointsBalancer(affiliatingUser);
            const affiliatedUserResult = await pointer.pointsBalancer(affiliatedUser);

            assert.equal(
                affiliatingUserResult.toString(),
                points / ratio
            );

            assert.equal(
                affiliatedUserResult.toString(),
                points / ratio * bonus
            );
        });

        it("should ONLY allow CEO to set defaultPlayerBonus, + generate event", async () => {

            const defaultPlayerBonus = await pointer.defaultPlayerBonus();

            const currentBonus = 30;
            const newBonus = 50;

            assert.equal(
                defaultPlayerBonus.toNumber(),
                currentBonus
            );

            await catchRevert(
                pointer.changeDefaultPlayerBonus(
                    newBonus,
                    { from: random }
                ),
                'revert AccessControl: CEO access denied'
            );

            await pointer.changeDefaultPlayerBonus(
                newBonus,
                { from: owner }
            );

            //test event
            const event = await getLastEvent(
                'updatedMaxPlayerBonus',
                pointer
            );

            assert.equal(
                event.newBonus,
                newBonus
            );

            const defaultPlayerBonusAfter = await pointer.defaultPlayerBonus();

            assert.equal(
                defaultPlayerBonusAfter,
                newBonus
            );

        });
    });

    describe("dgPointer bonus points", () => {

        beforeEach(async () => {
            token = await Token.new();
            pointer = await Pointer.new(
                token.address,
                name,
                version
            );
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

        it("should NOT allow 0 players", async () => {
            const points = 15000;
            await catchRevert(
                pointer.addPoints(
                    user1,
                    points,
                    token.address,
                    0, // _playersCount
                    0, // _wearableBonus
                    {from: owner},
                ),
                'revert dgPointer: _playersCount error'
            );
        });

        it("should allow 3 params for addPoints", async () => {

            const ratio = 150;
            const points = 15000;

            const resultBefore = await pointer.pointsBalancer(user1);

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.setTokenToPointRatio(
                owner,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address
            );

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfter,
                points / ratio
            );
        });

        it("should allow 4 params for addPoints", async () => {

            const ratio = 150;
            const points = 15000;

            const resultBefore = await pointer.pointsBalancer(user1);
            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.setTokenToPointRatio(
                owner,
                token.address,
                ratio
            );
            await pointer.addPoints(user1, points, token.address, 1);

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(resultBefore, 0);
            assert.equal(resultAfter, points/ratio);
        });

        it("should give 10% bonus for playersCount = 2", async () => {

            const ratio = 150;
            const points = 15000;
            const bonuspoints = points + ((points*10)/100);

            //check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.setTokenToPointRatio(
                owner,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address,
                2,
                0,
                {from: owner}
            );

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(resultBefore, 0);
            assert.equal(resultAfter, bonuspoints/ratio);
        });

        it("should give 20% bonus for playersCount = 3", async () => {

            const ratio = 150;
            const points = 15000;

            const bonuspoints = points + ((points * 20) / 100);

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.setTokenToPointRatio(
                owner,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address,
                3,
                0,
                {from: owner}
            );

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfter,
                bonuspoints / ratio
            );
        });

        it("should give 30% bonus for playersCount = 4", async () => {

            const ratio = 150;
            const points = 15000;

            const bonuspoints = points + ((points * 30) / 100);

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);

            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );

            await pointer.addPoints(
                user1,
                points,
                token.address,
                4,
                0,
                {from: user2}
            );

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(
                resultBefore,
                0
            );

            assert.equal(
                resultAfter,
                bonuspoints / ratio
            );
        });

        it("should only give 4 player bonus with +4 players", async () => {

            const ratio = 150;
            const points = 15000;

            // const bonuspoints = points * 1.3;

            const bonuspoints = 19500;

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);
            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );
            await pointer.addPoints(user1, points, token.address, 10, 0, {from: user2});

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(resultBefore, 0);
            assert.equal(resultAfter.toString(), bonuspoints/ratio);
        });

        it("should give 10% bonus for wearableCount = 1", async () => {
            const ratio = 150;
            const points = 15000;
            const bonuspoints = points + ((points * 10) / 100);

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);
            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );
            await pointer.addPoints(user1, points, token.address, 1, 1, {from: user2});

            const resultAfter = await pointer.pointsBalancer(user1);

            assert.equal(resultBefore, 0);
            assert.equal(resultAfter, bonuspoints/ratio);
        });

        it("should give 20% bonus for wearableCount = 2", async () => {
            const ratio = 150;
            const points = 15000;
            // const prevPoints = await pointer.pointsBalancer(user1);
            const bonuspoints = points + ((points * 20) / 100);

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);
            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );
            await pointer.addPoints(user1, points, token.address, 1, 2, {from: user2});

            const resultAfter = await pointer.pointsBalancer(user1);
            assert.equal(resultAfter, bonuspoints/ratio);
        });

        it("should give 30% bonus for wearableCount = 3", async () => {
            const ratio = 150;
            const points = 15000;
            // const prevPoints = await pointer.pointsBalancer(user8);
            const bonuspoints = points + ((points * 30) / 100);

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);
            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );
            await pointer.addPoints(user1, points, token.address, 1, 3, {from: user2});

            const resultAfter = await pointer.pointsBalancer(user1);
            assert.equal(resultAfter, bonuspoints/ratio);
        });

        it("should give 40% bonus for wearableCount = 4", async () => {
            const ratio = 150;
            const points = 15000;
            const bonuspoints = points + ((points * 40) / 100);

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);
            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );
            await pointer.addPoints(user1, points, token.address, 1, 4, {from: user2});

            const resultAfter = await pointer.pointsBalancer(user1);
            assert.equal(resultAfter, bonuspoints/ratio);
        });

        it("should give A MAX 40% bonus for wearableCount > 4", async () => {
            const ratio = 150;
            const points = 15000;
            const bonuspoints = points + ((points * 40) / 100);

            // check user1 pointsbalancer = 0 at first
            const resultBefore = await pointer.pointsBalancer(user1);
            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);
            await pointer.declareContract(user2);
            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );
            await pointer.addPoints(user1, points, token.address, 1, 10, {from: user2});

            const resultAfter = await pointer.pointsBalancer(user1);
            assert.equal(resultAfter, bonuspoints/ratio);
        });

        it("should allow to assign affiliate", async () => {

            const ratio = 150;
            const points = 15000;
            const bonus = 0.1;

            const affiliatedUser = user1;
            const affiliatingUser = user2;
            const workerUser = owner;

            // affiliate user
            await pointer.setWorker(
                workerUser,
                { from: owner }
            );

            const event = await getLastEvent(
                'WorkerSet',
                pointer
            );

            assert.equal(
                event.newWorker,
                workerUser
            );

            await pointer.assignAffiliate(
                affiliatedUser,
                affiliatingUser,
                { from: workerUser }
            );

            const affiliateAddress = await pointer.affiliateData(affiliatingUser);

            assert.equal(affiliateAddress, affiliatedUser);

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            await pointer.declareContract(user2);

            await pointer.setTokenToPointRatio(
                user2,
                token.address,
                ratio
            );

            await pointer.addPoints(
                affiliatingUser,
                points,
                token.address,
                1,
                0,
                {from: user2}
            );

            const affiliatingUserResult = await pointer.pointsBalancer(affiliatingUser);
            const affiliatedUserResult = await pointer.pointsBalancer(affiliatedUser);

            assert.equal(
                affiliatingUserResult.toString(),
                points / ratio
            );

            assert.equal(
                affiliatedUserResult.toString(),
                points / ratio * bonus
            );
        });
    });

    describe("dgPointer Tokens from games", () => {

        beforeEach(async () => {
            const ratio = 10;
            const ratioTwo = 20;
            const ratioThree = 5;
            const ratioFour = 2;

            token = await Token.new();
            secondtoken = await Token.new();

            pointer = await Pointer.new(
                token.address,
                name,
                version
            );

            treasury = await Treasury.new(
                token.address,
                "MANA"
            );

            treasury.addToken(
                secondtoken.address,
                "DAI"
            );

            slots = await Slots.new(
                treasury.address,
                250,
                16,
                8,
                4,
                pointer.address
            );

            backgammon = await Backgammon.new(
                treasury.address,
                1,
                10,
                pointer.address
            );

            pointer.declareContract(owner);
            pointer.declareContract(slots.address);
            pointer.declareContract(backgammon.address);

            await treasury.addGame(
                slots.address,
                "Slots",
                true,
                { from: owner }
            );

            await treasury.addGame(
                backgammon.address,
                "Backgammon",
                true,
                { from: owner }
            );

            //slots max bets
            await treasury.setMaximumBet(
                0,
                0,
                1000,
                { from: owner }
            );

            await treasury.setMaximumBet(
                0,
                1,
                1000,
                { from: owner }
            );

            //backgammon max bets
            await treasury.setMaximumBet(
                1,
                0,
                1000,
                { from: owner }
            );

            await treasury.setMaximumBet(
                1,
                1,
                1000,
                { from: owner }
            );

            await token.approve(
                treasury.address,
                web3.utils.toWei("200")
            );

            await secondtoken.approve(
                treasury.address,
                web3.utils.toWei("200")
            );

            //slots addfunds
            await treasury.addFunds(
                0,
                0,
                web3.utils.toWei("100"),
                {from: owner}
            );

            await treasury.addFunds(
                0,
                1,
                web3.utils.toWei("100"),
                {from: owner}
            );

            //backgammon addfunds
            await treasury.addFunds(
                1,
                0,
                web3.utils.toWei("100"),
                {from: owner}
            );

            await treasury.addFunds(
                1,
                1,
                web3.utils.toWei("100"),
                {from: owner}
            );

            await token.transfer(
                user1,
                10000
            );

            await secondtoken.transfer(
                user1,
                10000
            );

            await token.transfer(
                user2,
                10000
            );

            await secondtoken.transfer(
                user2,
                10000
            );

            await token.approve(
                treasury.address,
                5000,
                { from: user1 }
            );
            await secondtoken.approve(
                treasury.address,
                5000,
                { from: user1 }
            );

            await token.approve(
                treasury.address,
                5000,
                { from: user2 }
            );

            await secondtoken.approve(
                treasury.address,
                5000,
                { from: user2 }
            );

            await treasury.setTail(
                HASH_CHAIN[0],
                { from: owner }
            );


            await pointer.setTokenToPointRatio(
                slots.address,
                token.address,
                ratio
            );

            await pointer.setTokenToPointRatio(
                slots.address,
                secondtoken.address,
                ratioTwo
            );

            await pointer.setTokenToPointRatio(
                backgammon.address,
                token.address,
                ratioThree
            );

            await pointer.setTokenToPointRatio(
                backgammon.address,
                secondtoken.address,
                ratioFour
            );
        });

        it("should be able to play different games different tokens", async () => {

            await pointer.enableDistribtion(true);
            await pointer.enableCollecting(true);

            const defaultStake = 100;
            const backgammonPercent = 0.1;

            const playerOneWearableBonus = 0;
            const playerTwoWearableBonus = 0;

            const ratio = 10;
            const ratioTwo = 20;
            const ratioThree = 5;
            const ratioFour = 2;

            //FIRST
            await advanceTimeAndBlock(60);
            await slots.play(
                user1,
                1,
                2,
                defaultStake,
                HASH_CHAIN[1],
                0,
                0,
                { from: owner }
            );

            const firstresultAfter = await pointer.pointsBalancer(user1);

            const resultOne = defaultStake / ratio;

            assert.equal(
                firstresultAfter.toString(),
                resultOne
            );

            //SECOND
            await advanceTimeAndBlock(60);
            await slots.play(
                user1,
                1,
                2,
                defaultStake,
                HASH_CHAIN[2],
                1,
                0,
                { from: owner }
            );

            const secondresultAfter = await pointer.pointsBalancer(user1);

            const resultTwo = defaultStake / ratioTwo;

            assert.equal(
                secondresultAfter.toString(),
                resultOne + resultTwo
            );

            //THIRD
            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                0,
                { from: owner }
            );

            const _gameID = await backgammon.getGameIdOfPlayers(
                user1,
                user2
            );

            const thirdresultBefore = await pointer.pointsBalancer(user1);

            await backgammon.resolveGame(
                _gameID,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const thirdresultAfter = await pointer.pointsBalancer(user1);
            const thirdresultAfterSecondPlayer = await pointer.pointsBalancer(user2);

            const resultThree = defaultStake * 2 * backgammonPercent / ratioThree;

            assert.equal(
                thirdresultBefore.toString(),
                resultOne + resultTwo
            );

            assert.equal(
                thirdresultAfter.toNumber(),
                thirdresultBefore.toNumber() + resultThree
            );

            assert.equal(
                thirdresultAfter.toString(),
                resultOne + resultTwo + resultThree
            );

            //FOURTH
            await backgammon.initializeGame(
                defaultStake,
                user1,
                user2,
                1,
                { from: owner }
            );

            const _gameIDtwo = await backgammon.getGameIdOfPlayers(
                user1,
                user2
            );

            await backgammon.resolveGame(
                _gameIDtwo,
                user1,
                playerOneWearableBonus,
                playerTwoWearableBonus
            );

            const fourthresultAfter = await pointer.pointsBalancer(user1);

            const resultFour = defaultStake * 2 * backgammonPercent / ratioFour
            assert.equal(
                fourthresultAfter.toString(),
                resultOne + resultTwo + resultThree + resultFour
            );
        });
    });
});
