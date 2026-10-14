// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IdentityGate} from "./IdentityGate.sol";

/// @title CompliantToken
/// @notice An example app on the L1: an ERC-20, such as a tokenized fund share, that only moves between
/// accounts holding a claim in the IdentityGate. The token learns "verified until T" and nothing else.
contract CompliantToken is ERC20, Ownable {
    IdentityGate public immutable identityGate;
    bytes32 public immutable requiredClaim;

    error ClaimRequired(address account, bytes32 claimType);

    constructor(string memory name_, string memory symbol_, IdentityGate identityGate_, bytes32 requiredClaim_, address owner_)
        ERC20(name_, symbol_)
        Ownable(owner_)
    {
        identityGate = identityGate_;
        requiredClaim = requiredClaim_;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev Checks both sides of every transfer and mint; burns only check the sender.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && !identityGate.hasClaim(from, requiredClaim)) revert ClaimRequired(from, requiredClaim);
        if (to != address(0) && !identityGate.hasClaim(to, requiredClaim)) revert ClaimRequired(to, requiredClaim);
        super._update(from, to, value);
    }
}
