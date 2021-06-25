// SPDX-License-Identifier: -- 💰️ --

pragma solidity ^0.8.0;

import './AgreementManager.sol';

contract AgreementCreator is AgreementManager {

    constructor(
        address _tokenDG,
        address _tokenMANA,
        address _partnerDG,
        address _partnerMANA,
        uint256 _expectedAmountDG,
        uint256 _expectedAmountMANA,
        uint256 _minimumAmountDG,
        uint256 _minimumAmountMANA
    )
        AgreementDeclaration(
            _tokenDG,
            _tokenMANA,
            _partnerDG,
            _partnerMANA
        )
    {
        expectedAmountDG = _expectedAmountDG;
        expectedAmountMANA = _expectedAmountMANA;

        minimumAmountDG = _minimumAmountDG;
        minimumAmountMANA = _minimumAmountMANA;

        emit AgreementProposed(
            _expectedAmountDG,
            _expectedAmountMANA,
            _minimumAmountDG,
            _minimumAmountMANA
        );
    }

    function confirmAmountsDG()
        external
        onlyPartnerMANA
    {
        _safeBalanceOf(
            tokenDG,
            expectedAmountDG
        );

        confirmedDG = true;

        emit AgreementConfirmed(
            tokenDG,
            expectedAmountDG,
            minimumAmountDG
        );
    }

    function changeAmountsDG(
        uint256 _expectedAmount,
        uint256 _minimumAmount
    )
        external
        onlyPartnerMANA
    {
        expectedAmountDG = _expectedAmount;
        minimumAmountDG = _minimumAmount;

        confirmedDG = false;

        emit AgreementChanged(
            tokenDG,
            expectedAmountDG,
            minimumAmountDG
        );
    }

    function confirmAmountsMANA()
        external
        onlyPartnerDG
    {
        _safeBalanceOf(
            tokenMANA,
            expectedAmountMANA
        );

        confirmedMANA = true;

        emit AgreementConfirmed(
            tokenMANA,
            expectedAmountMANA,
            minimumAmountMANA
        );
    }

    function changeAmountsMANA(
        uint256 _expectedAmount,
        uint256 _minimumAmount
    )
        external
        onlyPartnerDG
    {
        expectedAmountMANA = _expectedAmount;
        minimumAmountMANA = _minimumAmount;

        confirmedMANA = false;

        emit AgreementChanged(
            tokenMANA,
            expectedAmountMANA,
            minimumAmountMANA
        );
    }
}
