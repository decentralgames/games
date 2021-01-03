// SPDX-License-Identifier: -- 🎲 --

pragma solidity ^0.7.4;

contract EIP712Base {

    struct EIP712Domain {
        string name;
        string version;
        uint256 chainId;
        address verifyingContract;
    }

    bytes32 internal constant EIP712_DOMAIN_TYPEHASH = keccak256(bytes("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"));

    bytes32 internal domainSeperator;

    constructor(string memory name, string memory version) {
      domainSeperator = keccak256(abi.encode(
			EIP712_DOMAIN_TYPEHASH,
			keccak256(bytes(name)),
			keccak256(bytes(version)),
			getChainID(),
			address(this)
		));
    }

    function getChainID() internal pure returns (uint256 id) {
		assembly {
			id := 1 // set to Goerli for now, Mainnet later
		}
	}

    function getDomainSeperator() private view returns(bytes32) {
		return domainSeperator;
	}

    function toTypedMessageHash(bytes32 messageHash) internal view returns(bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", getDomainSeperator(), messageHash));
    }

}
