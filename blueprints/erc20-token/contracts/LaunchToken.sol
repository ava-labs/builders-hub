// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title LaunchToken
/// @notice An 18-decimal ERC-20 with EIP-2612 permit and burning. The owner may mint more later, but
/// lifetime issuance never exceeds maxSupply; set maxSupply equal to initialSupply for a fixed supply.
contract LaunchToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint256 public immutable maxSupply;
    uint256 public totalMinted;

    error InvalidSupply(uint256 initialSupply, uint256 maxSupply);
    error MaxSupplyExceeded(uint256 requested, uint256 remaining);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 initialSupply,
        uint256 maxSupply_,
        address initialHolder,
        address owner_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) {
        if (maxSupply_ == 0 || maxSupply_ < initialSupply) revert InvalidSupply(initialSupply, maxSupply_);
        maxSupply = maxSupply_;
        _mintTracked(initialHolder, initialSupply);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mintTracked(to, amount);
    }

    /// @notice Tokens that can still be minted over the token's lifetime.
    function remainingMintable() public view returns (uint256) {
        return maxSupply - totalMinted;
    }

    function _mintTracked(address to, uint256 amount) private {
        uint256 remaining = remainingMintable();
        if (amount > remaining) revert MaxSupplyExceeded(amount, remaining);
        totalMinted += amount;
        _mint(to, amount);
    }
}
