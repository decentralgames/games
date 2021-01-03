// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

import "./common-contracts/SafeMath.sol";
import "./common-contracts/AccessController.sol";
import "./common-contracts/ERC20Token.sol";
import "./common-contracts/EIP712Base.sol";

abstract contract EIP712MetaTransaction is EIP712Base {

    using SafeMath for uint256;

    bytes32 private constant META_TRANSACTION_TYPEHASH =
        keccak256(
            bytes(
                "MetaTransaction(uint256 nonce,address from,bytes functionSignature)"
            )
        );

    event MetaTransactionExecuted(
        address userAddress,
        address payable relayerAddress,
        bytes functionSignature
    );

    mapping(address => uint256) internal nonces;

    /*
     * Meta transaction structure.
     * No point of including value field here as if user is doing value transfer then he has the funds to pay for gas
     * He should call the desired function directly in that case.
     */
    struct MetaTransaction {
		uint256 nonce;
		address from;
        bytes functionSignature;
	}

    function executeMetaTransaction(
        address userAddress,
        bytes memory functionSignature,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    )
        public
        payable
        returns(bytes memory)
    {
        MetaTransaction memory metaTx = MetaTransaction(
            {
                nonce: nonces[userAddress],
                from: userAddress,
                functionSignature: functionSignature
            }
        );

        require(
            verify(
                userAddress,
                metaTx,
                sigR,
                sigS,
                sigV
            ), "Signer and signature do not match"
        );

	    nonces[userAddress] =
	    nonces[userAddress].add(1);

        // Append userAddress at the end to extract it from calling context
        (bool success, bytes memory returnData) = address(this).call(
            abi.encodePacked(
                functionSignature,
                userAddress
            )
        );

        require(
            success,
            'Function call not successful'
        );

        emit MetaTransactionExecuted(
            userAddress,
            msg.sender,
            functionSignature
        );

        return returnData;
    }

    function hashMetaTransaction(
        MetaTransaction memory metaTx
    )
        internal
        pure
        returns (bytes32)
    {
		return keccak256(
		    abi.encode(
                META_TRANSACTION_TYPEHASH,
                metaTx.nonce,
                metaTx.from,
                keccak256(metaTx.functionSignature)
            )
        );
	}

    function getNonce(
        address user
    )
        external
        view
        returns(uint256 nonce)
    {
        nonce = nonces[user];
    }

    function verify(
        address user,
        MetaTransaction memory metaTx,
        bytes32 sigR,
        bytes32 sigS,
        uint8 sigV
    )
        internal
        view
        returns (bool)
    {
        address signer = ecrecover(
            toTypedMessageHash(
                hashMetaTransaction(metaTx)
            ),
            sigV,
            sigR,
            sigS
        );

        require(
            signer != address(0x0),
            'Invalid signature'
        );
		return signer == user;
	}

    function msgSender() internal view returns(address sender) {
        if(msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(mload(add(array, index)), 0xffffffffffffffffffffffffffffffffffffffff)
            }
        } else {
            sender = msg.sender;
        }
        return sender;
    }
}

contract dgPointer is AccessController, EIP712MetaTransaction {

    using SafeMath for uint256;

    uint256 public defaultPlayerBonus = 30;
    uint256 public defaultWearableBonus = 40;

    bool public collectingEnabled;
    bool public distributionEnabled;

    ERC20Token public distributionToken;

    mapping(address => bool) public declaredContracts;
    mapping(address => uint256) public pointsBalancer;
    mapping(address => mapping(address => uint256)) public tokenToPointRatio;
    mapping(uint256 => uint256) public playerBonuses;
    mapping(uint256 => uint256) public wearableBonuses;
    mapping(address => address) public affiliateData;

    uint256 public affiliateBonus;
    uint256 public wearableBonusPerObject;

    event updatedPlayerBonus(
        uint256 playersCount,
        uint256 newBonus
    );

    event updatedAffiliateBonus(
        uint256 newBonus
    );

    event updatedMaxPlayerBonus(
        uint256 newBonus
    );

    constructor(
        address _distributionToken,
        string memory name,
        string memory version
    ) EIP712Base(name, version) {

        distributionToken = ERC20Token(
            _distributionToken
        );

        affiliateBonus = 10;

        playerBonuses[2] = 10;
        playerBonuses[3] = 20;
        playerBonuses[4] = 30;

        wearableBonuses[1] = 10;
        wearableBonuses[2] = 20;
        wearableBonuses[3] = 30;
        wearableBonuses[4] = 40;
    }

    function assignAffiliate(
        address _affiliate,
        address _player
    )
        external
        onlyWorker
    {
        require(
            affiliateData[_player] == address(0x0),
            'Pointer: player already affiliated'
        );
        affiliateData[_player] = _affiliate;
    }

    function addPoints(
        address _player,
        uint256 _points,
        address _token
    )
        external
        returns (
            uint256 newPoints,
            uint256 multiplierA,
            uint256 multiplierB
        )
    {
        return addPoints(
            _player,
            _points,
            _token,
            1,
            0
        );
    }

    function addPoints(
        address _player,
        uint256 _points,
        address _token,
        uint256 _playersCount
    )
        public
        returns (
            uint256 newPoints,
            uint256 multiplier,
            uint256 multiplierB
        )
    {
        return addPoints(
            _player,
            _points,
            _token,
            _playersCount,
            0
        );
    }

    function addPoints(
        address _player,
        uint256 _points,
        address _token,
        uint256 _playersCount,
        uint256 _wearablesCount
    )
        public
        returns (
            uint256 newPoints,
            uint256 multiplierA,
            uint256 multiplierB
        )
    {
        require(
            _playersCount > 0,
            'dgPointer: _playersCount error'
        );

        if (_isDeclaredContract(msg.sender) && collectingEnabled) {

            multiplierA = getPlayerMultiplier(
                _playersCount,
                playerBonuses[_playersCount],
                defaultPlayerBonus
            );

            multiplierB = getWearableMultiplier(
                _wearablesCount,
                wearableBonuses[_wearablesCount],
                defaultWearableBonus
            );

            newPoints = _points
                .div(tokenToPointRatio[msg.sender][_token])
                .mul(uint256(100)
                    .add(multiplierA)
                    .add(multiplierB)
                )
                .div(100);

            pointsBalancer[_player] =
            pointsBalancer[_player].add(newPoints);

            _applyAffiliatePoints(
                _player,
                newPoints
            );
        }
    }

    function _applyAffiliatePoints(
        address _player,
        uint256 _points
    )
        internal
    {
        if (_isAffiliated(_player)) {
            pointsBalancer[affiliateData[_player]] =
            pointsBalancer[affiliateData[_player]] + _points
                .mul(affiliateBonus)
                .div(100);
        }
    }

    function getPlayerMultiplier(
        uint256 _playerCount,
        uint256 _playerBonus,
        uint256 _defaultPlayerBonus

    )
        internal
        pure
        returns (uint256)
    {
        if (_playerCount == 1) return 0;
        return _playerCount > 0 && _playerBonus == 0
            ? _defaultPlayerBonus
            : _playerBonus;
    }

    function getWearableMultiplier(
        uint256 _wearableCount,
        uint256 _wearableBonus,
        uint256 _defaultWearableBonus
    )
        internal
        pure
        returns (uint256)
    {
        return _wearableCount > 0 && _wearableBonus == 0
            ? _defaultWearableBonus
            : _wearableBonus;
    }

    function _isAffiliated(
        address _player
    )
        internal
        view
        returns (bool)
    {
        return affiliateData[_player] != address(0x0);
    }

    function getMyTokens()
        external
        returns(uint256 tokenAmount)
    {
        return distributeTokens(msgSender());
    }

    function distributeTokensBulk(
        address[] memory _player
    )
        external
    {
        for(uint i = 0; i < _player.length; i++) {
            distributeTokens(_player[i]);
        }
    }

    function distributeTokens(
        address _player
    )
        public
        returns (uint256 tokenAmount)
    {
        require(
            distributionEnabled == true,
            'Pointer: distribution disabled'
        );
        tokenAmount = pointsBalancer[_player];
        pointsBalancer[_player] = 0;
        distributionToken.transfer(_player, tokenAmount);
    }

    function changePlayerBonus(uint256 _bonusIndex, uint256 _newBonus)
        external
        onlyCEO
    {
        playerBonuses[_bonusIndex] = _newBonus;

        emit updatedPlayerBonus(
          _bonusIndex,
          playerBonuses[_bonusIndex]
        );
    }

    function changeAffiliateBonus(uint256 _newAffiliateBonus)
        external
        onlyCEO
    {
        affiliateBonus = _newAffiliateBonus;

        emit updatedAffiliateBonus(
            _newAffiliateBonus
        );
    }

    function changeDefaultPlayerBonus(
        uint256 _newDefaultPlayerBonus
    )
        external
        onlyCEO
    {
        defaultPlayerBonus =_newDefaultPlayerBonus;

        emit updatedMaxPlayerBonus(
            defaultPlayerBonus
        );
    }

    function changeMaxWearableBonus(
        uint256 _newMaxWearableBonus
    )
        external
        onlyCEO
    {
        defaultWearableBonus = _newMaxWearableBonus;
    }

    function changeDistributionToken(
        address _newDistributionToken
    )
        external
        onlyCEO
    {
        distributionToken = ERC20Token(
            _newDistributionToken
        );
    }

    function setTokenToPointRatio(
        address _gameAddress,
        address _token,
        uint256 _ratio
    )
        external
        onlyCEO
    {
        tokenToPointRatio[_gameAddress][_token] = _ratio;
    }

    function enableCollecting(
        bool _state
    )
        external
        onlyCEO
    {
        collectingEnabled = _state;
    }

    function enableDistribtion(
        bool _state
    )
        external
        onlyCEO
    {
        distributionEnabled = _state;
    }

    function declareContract(
        address _contract
    )
        external
        onlyCEO
    {
        declaredContracts[_contract] = true;
    }

    function unDeclareContract(
        address _contract
    )
        external
        onlyCEO
    {
        declaredContracts[_contract] = false;
    }

    function _isDeclaredContract(
        address _contract
    )
        internal
        view
        returns (bool)
    {
        return declaredContracts[_contract];
    }
}