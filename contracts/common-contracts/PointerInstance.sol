// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

interface PointerInstance {

    function addPoints(
        address _player,
        uint256 _points,
        address _token,
        uint256 _numPlayers,
        uint256 _wearableBonus
    ) external returns (
        uint256 newPoints,
        uint256 multiplierA,
        uint256 multiplierB
    );

    function addPoints(
        address _player,
        uint256 _points,
        address _token,
        uint256 _numPlayers
    ) external returns (
        uint256 newPoints,
        uint256 multiplierA,
        uint256 multiplierB
    );

    function addPoints(
        address _player,
        uint256 _points,
        address _token
    ) external returns (
        uint256 newPoints,
        uint256 multiplierA,
        uint256 multiplierB
    );
}