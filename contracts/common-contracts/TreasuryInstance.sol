// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

interface TreasuryInstance {

    function getTokenAddress(
        uint8 _tokenIndex
    ) external view returns (address);

    function tokenInboundTransfer(
        uint8 _tokenIndex,
        address _from,
        uint256 _amount
    )  external returns (bool);

    function tokenOutboundTransfer(
        uint8 _tokenIndex,
        address _to,
        uint256 _amount
    ) external returns (bool);

    function checkAllocatedTokens(
        uint8 _tokenIndex
    ) external view returns (uint256);

    function checkApproval(
        address _userAddress,
        uint8 _tokenIndex
    ) external view returns (uint256 approved);

    function getMaximumBet(
        uint8 _tokenIndex
    ) external view returns (uint128);

    function consumeHash(
        bytes32 _localhash
    ) external returns (bool);
}
