// SPDX-License-Identifier: -- 💰️ --

pragma solidity ^0.8.0;

contract AgreementHelper {

    bytes4 private constant APPROVE = bytes4(
        keccak256(
            bytes(
                'approve(address,uint256)'
            )
        )
    );

    bytes4 private constant TRANSFER = bytes4(
        keccak256(
            bytes(
                'transfer(address,uint256)'
            )
        )
    );

    bytes4 private constant TRANSFER_FROM = bytes4(
        keccak256(
            bytes(
                'transferFrom(address,address,uint256)'
            )
        )
    );

    bytes4 private constant BALANCE_OF = bytes4(
        keccak256(
            bytes(
                'balanceOf(address)'
            )
        )
    );

    function _safeApprove(
        address _token,
        address _spender,
        uint256 _amount
    )
        internal
    {
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(
                APPROVE,
                _spender,
                _amount
            )
        );

        require(
            success && (
                data.length == 0 || abi.decode(
                    data, (bool)
                )
            ),
            'safeApprove: approve failed'
        );
    }

    function _safeTransfer(
        address _token,
        address _to,
        uint256 _value
    )
        internal
    {
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(
                TRANSFER,
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
            'safeTransfer: transfer failed'
        );
    }

    function _safeTransferFrom(
        address _token,
        address _from,
        address _to,
        uint256 _value
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
            'safeTransferFrom: transfer failed'
        );
    }

    function _safeBalanceOf(
        address _token,
        uint256 _required
    )
        internal
    {
        (bool success, bytes memory data) = _token.call(
            abi.encodeWithSelector(
                BALANCE_OF,
                address(this)
            )
        );

        require(
            success && abi.decode(
                data, (uint256)
            ) >= _required,
            'safeBalanceOf: balance failed'
        );
    }
}
