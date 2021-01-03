// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

// Slot Machine Logic Contract ///////////////////////////////////////////////////////////
// Author: Decentral Games (hello@decentral.games) ///////////////////////////////////////
// Single Play - Simple Slots - TokenIndex

import "./common-contracts/SafeMath.sol";
import "./common-contracts/AccessController.sol";
import "./common-contracts/TreasuryInstance.sol";
import "./common-contracts/PointerInstance.sol";

contract dgSlots is AccessController {

    using SafeMath for uint128;

    uint256 private factors;
    TreasuryInstance public treasury;
    PointerInstance public pointerContract;

    event GameResult(
        address _player,
        uint8 _tokenIndex,
        uint128 _landID,
        uint256 indexed _number,
        uint128 indexed _machineID,
        uint256 _winAmount
    );

    constructor(
        address _treasury,
        uint16 factor1,
        uint16 factor2,
        uint16 factor3,
        uint16 factor4,
        address _pointerAddress
        )
    {
        treasury = TreasuryInstance(
            _treasury
        );

        require(
            factor1 > factor2 + factor3 + factor4,
            'Slots: incorrect ratio'
        );

        factors |= uint256(factor1)<<0;
        factors |= uint256(factor2)<<16;
        factors |= uint256(factor3)<<32;
        factors |= uint256(factor4)<<48;

        pointerContract = PointerInstance(
            _pointerAddress
        );
    }

    function play(
        address _player,
        uint128 _landID,
        uint128 _machineID,
        uint128 _betAmount,
        bytes32 _localhash,
        uint8 _tokenIndex,
        uint256 _wearableBonus
    )
        public
        whenNotPaused
        onlyWorker
    {
        require(
            treasury.checkApproval(_player, _tokenIndex) >= _betAmount,
            'Slots: exceeded allowance amount'
        );

        require(
            treasury.getMaximumBet(_tokenIndex) >= _betAmount,
            'Slots: exceeded maximum bet amount'
        );

        require(
            treasury.checkAllocatedTokens(_tokenIndex) >= getMaxPayout(_betAmount),
            'Slots: not enough tokens for payout'
        );

        treasury.tokenInboundTransfer(
            _tokenIndex,
            _player,
            _betAmount
        );

        treasury.consumeHash(
           _localhash
        );

        pointerContract.addPoints(
            _player,
            _betAmount,
            treasury.getTokenAddress(_tokenIndex),
            1,
            _wearableBonus
        );

        (uint256 _number, uint256 _winAmount) = _launch(
            _localhash,
            _betAmount
        );

        if (_winAmount > 0) {
            treasury.tokenOutboundTransfer(
                _tokenIndex,
                _player,
                _winAmount
            );
        }

        emit GameResult(
            _player,
            _tokenIndex,
            _landID,
            _number,
            _machineID,
            _winAmount
        );
    }

    function _launch(
        bytes32 _localhash,
        uint128 _betAmount
    )
        internal
        view
        returns (
            uint256 number,
            uint256 winAmount
        )
    {
        number = getRandomNumber(_localhash) % 1000;
        uint256 _numbers = number;

        uint8[5] memory _positions = [255, 0, 16, 32, 48];
        uint8[10] memory _symbols = [4, 4, 4, 4, 3, 3, 3, 2, 2, 1];
        uint256 _winner = _symbols[_numbers % 10];

        for (uint256 i = 0; i < 2; i++) {
            _numbers = uint256(_numbers) / 10;
            if (_symbols[_numbers % 10] != _winner) {
                _winner = 0;
                break;
            }
        }

        delete _symbols;
        delete _numbers;

        winAmount = _betAmount.mul(
            uint16(
                factors>>_positions[_winner]
            )
        );
    }

    function getRandomNumber(
        bytes32 _localhash
    )
        private
        pure
        returns (uint256)
    {
        return uint256(
            keccak256(
                abi.encodePacked(
                    _localhash
                )
            )
        );
    }

    function getPayoutFactor(
        uint8 _position
    )
        external
        view
        returns (uint16)
    {
        return uint16(
           factors>>_position
        );
    }

    function getMaxPayout(
        uint128 _betSize
    )
        public
        view
        returns (uint256)
    {
        return _betSize.mul(
            uint16(
                factors>>0
            )
        );
    }

    function updateFactors(
        uint16 factor1,
        uint16 factor2,
        uint16 factor3,
        uint16 factor4
    )
        external
        onlyCEO
    {
        require(
            factor1 > factor2 + factor3 + factor4,
            'Slots: incorrect ratio'
        );

        factors = uint256(0);

        factors |= uint256(factor1)<<0;
        factors |= uint256(factor2)<<16;
        factors |= uint256(factor3)<<32;
        factors |= uint256(factor4)<<48;
    }

    function updateTreasury(
        address _newTreasuryAddress
    )
        external
        onlyCEO
    {
        treasury = TreasuryInstance(
            _newTreasuryAddress
        );
    }

    function updatePointer(address _newPointerAddress)
        external
        onlyCEO
    {
         pointerContract = PointerInstance(
            _newPointerAddress
        );
    }
}