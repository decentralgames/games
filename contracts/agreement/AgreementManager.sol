// SPDX-License-Identifier: -- 💰️ --

pragma solidity ^0.8.0;

import './AgreementHelper.sol';
import './AgreementDeclaration.sol';

abstract contract AgreementManager is AgreementDeclaration, AgreementHelper {

    function addTokensDG(
        uint256 _tokenAmount
    )
        external
    {
        _safeTransferFrom(
            tokenDG,
            msg.sender,
            address(this),
            _tokenAmount
        );

        emit TokensAdded(
            tokenDG,
            _tokenAmount
        );
    }

    function addTokensMANA(
        uint256 _tokenAmount
    )
        external
    {
        _safeTransferFrom(
            tokenMANA,
            msg.sender,
            address(this),
            _tokenAmount
        );

        emit TokensAdded(
            tokenMANA,
            _tokenAmount
        );
    }

    function removeTokensDG(
        uint256 _tokenAmount
    )
        external
        onlyPartnerDG
    {
        _safeTransfer(
            tokenDG,
            msg.sender,
            _tokenAmount
        );

        confirmedDG = false;

        emit TokensRemoved(
            tokenDG,
            _tokenAmount
        );
    }

    function removeTokensMANA(
        uint256 _tokenAmount
    )
        external
        onlyPartnerMANA
    {
        _safeTransfer(
            tokenMANA,
            msg.sender,
            _tokenAmount
        );

        confirmedMANA = false;

        emit TokensRemoved(
            tokenMANA,
            _tokenAmount
        );
    }

    function addLiquidity()
        external
        onlyPartners
    {
        require(
            confirmedDG == true,
            'AgreementManager: DG missing'
        );

        require(
            confirmedMANA == true,
            'AgreementManager: MANA missing'
        );

        _safeApprove(
            tokenDG,
            address(QUICKSWAP_ROUTER),
            expectedAmountDG
        );

        _safeApprove(
            tokenMANA,
            address(QUICKSWAP_ROUTER),
            expectedAmountMANA
        );

        (
            uint256 amountDG,
            uint256 amountMANA,
            uint256 liquidity
        ) =

        QUICKSWAP_ROUTER.addLiquidity(
            tokenDG,
            tokenMANA,
            expectedAmountDG,
            expectedAmountMANA,
            minimumAmountDG,
            minimumAmountMANA,
            address(this),
            block.timestamp + 5 minutes
        );

        PAIR_ADDRESS = QUICKSWAP_FACTORY.getPair(
            tokenDG,
            tokenMANA
        );

        confirmedDG = false;
        confirmedMANA = false;

        liquidityTokenAmount =
        liquidityTokenAmount + liquidity;

        emit LiquidityAdded(
            amountDG,
            amountMANA,
            liquidity
        );
    }

    function removeLiquidity(
        uint256 _tokenAmount
    )
        external
        onlyPartners
    {
        _safeApprove(
            PAIR_ADDRESS,
            address(QUICKSWAP_ROUTER),
            _tokenAmount
        );

        liquidityTokenAmount =
        liquidityTokenAmount - _tokenAmount;

        (
            uint256 amountDG,
            uint256 amountMANA
        ) =

        QUICKSWAP_ROUTER.removeLiquidity(
            tokenDG,
            tokenMANA,
            _tokenAmount,
            0,
            0,
            address(this),
            block.timestamp + 5 minutes
        );

        _safeTransfer(
            tokenDG,
            partnerMANA,
            amountDG/2
        );

        _safeTransfer(
            tokenMANA,
            partnerDG,
            amountMANA/2
        );

        emit LiquidityRemoved(
            amountDG,
            amountMANA,
            _tokenAmount
        );
    }
}
