// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

contract HashChain {
    bytes32 public tail;

    function _setTail(bytes32 _tail) internal {
        tail = _tail;
    }

    function _consume(bytes32 _parent) internal {
        require(
            keccak256(
                abi.encodePacked(_parent)
            ) == tail,
            'hash-chain: wrong parent'
        );
        tail = _parent;
    }
}