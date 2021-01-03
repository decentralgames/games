// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

import "./common-contracts/SafeMath.sol";
import "./common-contracts/ERC20Token.sol";
import "./common-contracts/HashChain.sol";
import "./common-contracts/AccessController.sol";
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

    uint256 constant defaultTimeFrame = 12 hours;

    mapping(address => uint256) public enabledTill;
    mapping(address => uint256) public timeFrame;

    modifier onlyEnabledOrNewAccount(address _account) {
        require(
            isEnabled(_account) ||
            enabledTill[_account] == 0,
            'Treasury: disabled account!'
        );
        _;
    }

    modifier onlyEnabledAccountStrict(address _account) {
        require(
            isEnabled(_account),
            'Treasury: disabled account!'
        );
        _;
    }


    function enableAccount(
        uint256 _sessionDuration
    )
        external
    {
        _enableAccount(
            msgSender(),
            _sessionDuration
        );
    }

    event AccountEnabled(
        address _user,
        uint256 _sessionDuration
    );

    function _enableAccount(
        address _user,
        uint256 _sessionDuration
    )
        internal
    {
        emit AccountEnabled(
            _user,
            _sessionDuration
        );

        timeFrame[_user] = _sessionDuration;
        enabledTill[_user] = block.timestamp.add(timeFrame[_user]);
    }

    function getTimeFrame(
        address _account
    )
        internal
        view
        returns (uint256)
    {
        return
            timeFrame[_account] > 0 ?
            timeFrame[_account] : defaultTimeFrame;
    }

    function isEnabled(
        address _account
    )
        public
        view
        returns (bool)
    {
        return enabledTill[_account] > block.timestamp;
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

contract TransferHelper {

    bytes4 private constant TRANSFER = bytes4(
        keccak256(
            bytes(
                'transfer(address,uint256)' // 0xa9059cbb
            )
        )
    );

    bytes4 private constant TRANSFER_FROM = bytes4(
        keccak256(
            bytes(
                'transferFrom(address,address,uint256)' // 0x23b872dd
            )
        )
    );

    function safeTransfer(
        address _token,
        address _to,
        uint256 _value
    )
        internal
    {
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(
                TRANSFER, // 0xa9059cbb
                _to,
                _value
            )
        );

        require(
            success && (
                data.length == 0 || abi.decode(
                    data, (bool)
                )
            ),
            'TransferHelper: TRANSFER_FAILED'
        );
    }

    function safeTransferFrom(
        address _token,
        address _from,
        address _to,
        uint _value
    )
        internal
    {
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(
                TRANSFER_FROM,
                _from,
                _to,
                _value
            )
        );

        require(
            success && (
                data.length == 0 || abi.decode(
                    data, (bool)
                )
            ),
            'TransferHelper: TRANSFER_FROM_FAILED'
        );
    }

}

contract GameController is AccessController {

    using SafeMath for uint256;

    enum GameStatus { Empty, Enabled, Disabled }

    struct Game {
        address gameAddress;
        string gameName;
    }

    struct GameSettings {
        uint8 index;
        GameStatus status;
    }

    Game[] public treasuryGames;
    mapping(address => GameSettings) public settings;
    mapping(uint8 => mapping(uint8 => uint256)) gameTokens;
    mapping(uint8 => mapping(uint8 => uint128)) maximumBet;

    modifier onlyDeclaredGame(uint8 _gameIndex) {
        require(
            settings[
                treasuryGames[_gameIndex].gameAddress
            ].status != GameStatus.Empty,
            "Treasury: game is not declared!"
        );
        _;
    }

    modifier onlyEnabledGame(uint8 _gameIndex) {
        require(
            settings[
                treasuryGames[_gameIndex].gameAddress
            ].status == GameStatus.Enabled,
            "Treasury: game must be enabled!"
        );
        _;
    }

    modifier onlyDisabledGame(uint8 _gameIndex) {
        require(
            settings[
                treasuryGames[_gameIndex].gameAddress
            ].status == GameStatus.Disabled,
            "Treasury: game must be disabled!"
        );
        _;
    }

   function addGame(
        address _newGameAddress,
        string calldata _newGameName,
        bool _isActive
    )
        external
        onlyCEO
    {
        require(
            settings[_newGameAddress].status == GameStatus.Empty,
            'Treasury: game already declared!'
        );

        treasuryGames.push(
            Game(
                {
                    gameAddress: _newGameAddress,
                    gameName: _newGameName
                }
            )
        );
        settings[_newGameAddress].index = uint8(treasuryGames.length - 1);
        settings[_newGameAddress].status = _isActive == true
            ? GameStatus.Enabled
            : GameStatus.Disabled;
    }

    function getGameIndex(
        address _gameAddress
    )
        internal
        view
        returns (uint8)
    {
        require(
            settings[_gameAddress].status != GameStatus.Empty,
            'Treasury: game is not declared!'
        );
        return settings[_gameAddress].index;
    }

    function updateGameAddress(
        uint8 _gameIndex,
        address _newGameAddress
    )
        external
        onlyCEO
        onlyDeclaredGame(_gameIndex)
    {
        require(
            settings[_newGameAddress].status == GameStatus.Empty,
            'Treasury: game with new address already declared!'
        );

        settings[_newGameAddress] = settings[treasuryGames[_gameIndex].gameAddress];
        delete settings[treasuryGames[_gameIndex].gameAddress];
        treasuryGames[_gameIndex].gameAddress = _newGameAddress;
    }

    function updateGameName(
        uint8 _gameIndex,
        string calldata _newGameName
    )
        external
        onlyCEO
    {
        treasuryGames[_gameIndex].gameName = _newGameName;
    }

    function enableGame(
        uint8 _gameIndex
    )
        external
        onlyCEO
        onlyDisabledGame(_gameIndex)
    {
        settings[treasuryGames[_gameIndex].gameAddress].status = GameStatus.Enabled;
    }

    function disableGame(
        uint8 _gameIndex
    )
        external
        onlyCEO
        onlyEnabledGame(_gameIndex)
    {
        settings[treasuryGames[_gameIndex].gameAddress].status = GameStatus.Disabled;
    }

    function addGameTokens(
        uint8 _gameIndex,
        uint8 _tokenIndex,
        uint256 _amount
    )
        internal
    {
        gameTokens[_gameIndex][_tokenIndex] =
        gameTokens[_gameIndex][_tokenIndex].add(_amount);
    }

    function subGameTokens(
        uint8 _gameIndex,
        uint8 _tokenIndex,
        uint256 _amount
    )
        internal
    {
        gameTokens[_gameIndex][_tokenIndex] =
        gameTokens[_gameIndex][_tokenIndex].sub(_amount);
    }
}

contract TokenController is AccessController {

    struct Token {
        address tokenAddress;
        string tokenName;
    }

    Token[] public treasuryTokens;

    function addToken(
        address _tokenAddress,
        string memory _tokenName
    )
        public
        onlyCEO
    {
        treasuryTokens.push(
            Token(
                {
                    tokenAddress: _tokenAddress,
                    tokenName: _tokenName
                }
            )
        );
    }

    function getTokenInstance(
        uint8 _tokenIndex
    )
        internal
        view
        returns (ERC20Token)
    {
        return ERC20Token(treasuryTokens[_tokenIndex].tokenAddress);
    }

    function getTokenAddress(
        uint8 _tokenIndex
    )
        public
        view
        returns (address)
    {
        return treasuryTokens[_tokenIndex].tokenAddress;
    }

    function getTokenName(
        uint8 _tokenIndex
    )
        external
        view
        returns (string memory)
    {
        return treasuryTokens[_tokenIndex].tokenName;
    }

    function updateTokenAddress(
        uint8 _tokenIndex,
        address _newTokenAddress
    )
        external
        onlyCEO
    {
        treasuryTokens[_tokenIndex].tokenAddress = _newTokenAddress;
    }

    function updateTokenName(
        uint8 _tokenIndex,
        string calldata _newTokenName
    )
        external
        onlyCEO
    {
        treasuryTokens[_tokenIndex].tokenName = _newTokenName;
    }

    function deleteToken(
        uint8 _tokenIndex
    )
        external
        onlyCEO
    {
        ERC20Token token = getTokenInstance(
            _tokenIndex
        );

        require(
            token.balanceOf(address(this)) == 0,
            'TokenController: balance detected'
        );

        delete treasuryTokens[_tokenIndex];
    }
}

contract dgTreasury is GameController, TokenController, HashChain, TransferHelper, EIP712MetaTransaction {

    using SafeMath for uint256;

    constructor(
        address _defaultTokenAddress,
        string memory _defaultTokenName
    )
        EIP712Base('Treasury', 'v4.0')
    {
        addToken(
            _defaultTokenAddress,
            _defaultTokenName
        );
    }

    function disableAccount(
        address _account
    )
        external
        onlyWorker
    {
        enabledTill[_account] = block.timestamp;
    }

    function tokenInboundTransfer(
        uint8 _tokenIndex,
        address _from,
        uint256 _amount
    )
        external
        onlyEnabledOrNewAccount(_from)
        returns (bool)
    {
        uint8 _gameIndex = getGameIndex(msg.sender);
        address _token = getTokenAddress(_tokenIndex);

        addGameTokens(
            _gameIndex,
            _tokenIndex,
            _amount
        );

        safeTransferFrom(
            _token,
            _from,
            address(this), _amount
        );

        enabledTill[_from] = block.timestamp.add(getTimeFrame(msg.sender));

        return true;
    }

    function tokenOutboundTransfer(
        uint8 _tokenIndex,
        address _to,
        uint256 _amount
    )
        external
        onlyEnabledAccountStrict(_to)
        returns (bool)
    {
        uint8 _gameIndex = getGameIndex(msg.sender);
        address _token = getTokenAddress(_tokenIndex);

        subGameTokens(
            _gameIndex,
            _tokenIndex,
            _amount
        );

        safeTransfer(
            _token,
            _to,
            _amount
        );

        return true;
    }

    function setMaximumBet(
        uint8 _gameIndex,
        uint8 _tokenIndex,
        uint128 _maximumBet
    )
        external
        onlyCEO
        onlyDeclaredGame(_gameIndex)
    {
        maximumBet[_gameIndex][_tokenIndex] = _maximumBet;
    }

    function gameMaximumBet(
        uint8 _gameIndex,
        uint8 _tokenIndex
    )
        external
        view
        onlyDeclaredGame(_gameIndex)
        returns (uint256)
    {
        return maximumBet[_gameIndex][_tokenIndex];
    }

    function getMaximumBet(
        uint8 _tokenIndex
    )
        external
        view
        returns (uint128)
    {
        uint8 _gameIndex = getGameIndex(msg.sender);
        return maximumBet[_gameIndex][_tokenIndex];
    }

    function deleteGame(
        uint8 _gameIndex
    )
        public
        onlyCEO
    {
        for (uint8 _tokenIndex = 0; _tokenIndex < treasuryTokens.length; _tokenIndex++) {
            _withdrawGameTokens(
                _gameIndex,
                _tokenIndex,
                gameTokens[_gameIndex][_tokenIndex]
            );
            gameTokens[_gameIndex][_tokenIndex] = 0;
            maximumBet[_gameIndex][_tokenIndex] = 0;
        }
        delete treasuryGames[_gameIndex];
    }

    function checkApproval(
        address _userAddress,
        uint8 _tokenIndex
    )
        external
        view
        returns (uint256)
    {
        return getTokenInstance(_tokenIndex).allowance(
            _userAddress,
            address(this)
        );
    }

    receive() external payable {
        revert();
    }

    function addFunds(
        uint8 _gameIndex,
        uint8 _tokenIndex,
        uint256 _tokenAmount
    )
        external
    {
        require(
            _gameIndex < treasuryGames.length,
            'Treasury: unregistered gameIndex'
        );

        require(
            _tokenIndex < treasuryTokens.length,
            'Treasury: unregistered tokenIndex'
        );

        ERC20Token token = getTokenInstance(
            _tokenIndex
        );

        addGameTokens(
            _gameIndex,
            _tokenIndex,
            _tokenAmount
        );

        token.transferFrom(
            msg.sender,
            address(this),
            _tokenAmount
        );
    }

    function checkAllocatedTokens(
        uint8 _tokenIndex
    )
        external
        view
        returns (uint256)
    {
        uint8 _gameIndex = getGameIndex(msg.sender);

        return _checkAllocatedTokens(
            _gameIndex,
            _tokenIndex
        );
    }

    function _checkAllocatedTokens(
        uint8 _gameIndex,
        uint8 _tokenIndex
    ) internal view returns (uint256) {
        return gameTokens[_gameIndex][_tokenIndex];
    }

    function checkGameTokens(
        uint8 _gameIndex,
        uint8 _tokenIndex
    )
        external
        view
        returns (uint256)
    {
        return _checkAllocatedTokens(
            _gameIndex,
            _tokenIndex
        );
    }

    function _withdrawGameTokens(
        uint8 _gameIndex,
        uint8 _tokenIndex,
        uint256 _amount
    )
        internal
    {
        ERC20Token token = getTokenInstance(
            _tokenIndex
        );

        subGameTokens(
            _gameIndex,
            _tokenIndex,
            _amount
        );

        token.transfer(
            ceoAddress,
            _amount
        );
    }

    function withdrawGameTokens(
        uint8 _gameIndex,
        uint8 _tokenIndex,
        uint256 _amount
    )
        external
        onlyCEO
    {
        _withdrawGameTokens(
            _gameIndex,
            _tokenIndex,
            _amount
        );
    }

    function withdrawTreasuryTokens(
        uint8 _tokenIndex
    ) public onlyCEO {

        ERC20Token token = getTokenInstance(
            _tokenIndex
        );

        uint256 amount = token.balanceOf(
            address(this)
        );

        for (uint256 i = 0; i < treasuryGames.length; i++) {
            uint8 _gameIndex = settings[treasuryGames[i].gameAddress].index;
            gameTokens[_gameIndex][_tokenIndex] = 0;
        }

        token.transfer(
            ceoAddress,
            amount
        );
    }

    function setTail(
        bytes32 _tail
    )
        external
        onlyCEO
    {
        _setTail(_tail);
    }

    function consumeHash(
        bytes32 _localhash
    )
        external
        returns (bool)
    {
        require(
            settings[msg.sender].status == GameStatus.Enabled,
            'Treasury: active-game not present'
        );

        _consume(_localhash);

        return true;
    }
}