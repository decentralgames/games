// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

contract AccessController {

    address public ceoAddress;
    address public workerAddress;

    bool public paused = false;

    event CEOSet(address newCEO);
    event WorkerSet(address newWorker);

    event Paused();
    event Unpaused();

    constructor() {
        ceoAddress = msg.sender;
        workerAddress = msg.sender;
        emit CEOSet(ceoAddress);
        emit WorkerSet(workerAddress);
    }

    modifier onlyCEO() {
        require(
            msg.sender == ceoAddress,
            'AccessControl: CEO access denied'
        );
        _;
    }

    modifier onlyWorker() {
        require(
            msg.sender == workerAddress,
            'AccessControl: worker access denied'
        );
        _;
    }

    modifier whenNotPaused() {
        require(
            !paused,
            'AccessControl: currently paused'
        );
        _;
    }

    modifier whenPaused {
        require(
            paused,
            'AccessControl: currenlty not paused'
        );
        _;
    }

    function setCEO(address _newCEO) public onlyCEO {
        require(
            _newCEO != address(0x0),
            'AccessControl: invalid CEO address'
        );
        ceoAddress = _newCEO;
        emit CEOSet(ceoAddress);
    }

    function setWorker(address _newWorker) external {
        require(
            _newWorker != address(0x0),
            'AccessControl: invalid worker address'
        );
        require(
            msg.sender == ceoAddress || msg.sender == workerAddress,
            'AccessControl: invalid worker address'
        );
        workerAddress = _newWorker;
        emit WorkerSet(workerAddress);
    }

    function pause() external onlyWorker whenNotPaused {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyCEO whenPaused {
        paused = false;
        emit Unpaused();
    }
}