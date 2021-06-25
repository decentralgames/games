// SPDX-License-Identifier: -- 💰️ --

pragma solidity ^0.8.0;

import './Interfaces.sol';

contract AgreementDeclaration {

    IQuickswapV2Factory public constant QUICKSWAP_FACTORY = IQuickswapV2Factory(
        0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32
    );

    IQuickswapRouterV2 public constant QUICKSWAP_ROUTER = IQuickswapRouterV2(
        0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
    );

    address public PAIR_ADDRESS;

    address immutable public tokenDG;
    address immutable public tokenMANA;

    address immutable public partnerDG;
    address immutable public partnerMANA;

    uint256 public expectedAmountDG;
    uint256 public expectedAmountMANA;

    uint256 public minimumAmountDG;
    uint256 public minimumAmountMANA;

    uint256 public liquidityTokenAmount;

    bool public confirmedDG;
    bool public confirmedMANA;

    modifier onlyPartnerDG() {
        require(
            msg.sender == partnerDG,
            'onlyPartnerDG: invalid'
        );
        _;
    }

    modifier onlyPartnerMANA() {
        require(
            msg.sender == partnerMANA,
            'onlyPartnerMANA: invalid'
        );
        _;
    }

    modifier onlyPartners() {
        require(
            msg.sender == partnerDG ||
            msg.sender == partnerMANA,
            'onlyPartners: invald'
        );
        _;
    }

    event AgreementProposed(
        uint256 expectedAmountDG,
        uint256 expectedAmountMANA,
        uint256 minimumAmountDG,
        uint256 minimumAmountMANA
    );

    event AgreementChanged(
        address indexed tokenAddress,
        uint256 amountExpected,
        uint256 amountMinimum
    );

    event AgreementConfirmed(
        address indexed tokenAddress,
        uint256 amountExpected,
        uint256 amountMinimum
    );

    event TokensAdded(
        address indexed tokenAddress,
        uint256 tokenAmount
    );

    event TokensRemoved(
        address indexed tokenAddress,
        uint256 tokenAmount
    );

    event LiquidityAdded(
        uint256 amountDG,
        uint256 amountMANA,
        uint256 liquidity
    );

    event LiquidityRemoved(
        uint256 amountDG,
        uint256 amountMANA,
        uint256 liquidity
    );

    constructor(
        address _tokenDG,
        address _tokenMANA,
        address _partnerDG,
        address _partnerMANA
    ) {
        tokenDG = _tokenDG;
        tokenMANA = _tokenMANA;

        partnerDG = _partnerDG;
        partnerMANA = _partnerMANA;
    }
}
