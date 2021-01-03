// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

contract MultiHashChain {

    mapping(
        uint256 => mapping(
            uint256 => mapping(
                uint256 => bytes32
            )
        )
    ) public tail;

    function _setMultiTail(
        uint256 _serverId,
        uint256 _landId,
        uint256 _tableId,
        bytes32 _tail
    ) internal {
        tail[_serverId][_landId][_tableId] = _tail;
    }

    function _consumeMulti(
        uint256 _serverId,
        uint256 _landId,
        uint256 _tableId,
        bytes32 _parent
    ) internal {
        require(
            keccak256(
                abi.encodePacked(_parent)
            ) == tail[_serverId][_landId][_tableId],
            'hash-chain: wrong parent'
        );
        tail[_serverId][_landId][_tableId] = _parent;
    }
}