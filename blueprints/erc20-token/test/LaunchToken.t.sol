// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LaunchToken} from "../contracts/LaunchToken.sol";

contract LaunchTokenTest is Test {
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    function test_CapCoversLifetimeIssuance() public {
        LaunchToken token = new LaunchToken("Launch", "LCH", 100e18, 150e18, alice, owner);
        assertEq(token.balanceOf(alice), 100e18);
        assertEq(token.remainingMintable(), 50e18);

        vm.prank(owner);
        token.mint(alice, 50e18);
        vm.prank(alice);
        token.burn(10e18);

        // Burning does not free room to mint again.
        vm.expectRevert(abi.encodeWithSelector(LaunchToken.MaxSupplyExceeded.selector, 1, 0));
        vm.prank(owner);
        token.mint(alice, 1);
        assertEq(token.totalSupply(), 140e18);
    }

    function test_RevertWhen_NotOwnerOrSupplyInvalid() public {
        LaunchToken token = new LaunchToken("Launch", "LCH", 100e18, 200e18, alice, owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vm.prank(alice);
        token.mint(alice, 1);

        vm.expectRevert(abi.encodeWithSelector(LaunchToken.InvalidSupply.selector, 100e18, 50e18));
        new LaunchToken("Launch", "LCH", 100e18, 50e18, alice, owner);
    }

    function testFuzz_TotalMintedNeverExceedsMaxSupply(uint256 initial, uint256 cap, uint256 extra) public {
        cap = bound(cap, 1, type(uint128).max);
        initial = bound(initial, 0, cap);
        LaunchToken token = new LaunchToken("Launch", "LCH", initial, cap, alice, owner);
        extra = bound(extra, 0, type(uint128).max);

        vm.prank(owner);
        if (extra > cap - initial) {
            vm.expectRevert();
            token.mint(alice, extra);
        } else {
            token.mint(alice, extra);
        }
        assertLe(token.totalMinted(), token.maxSupply());
    }
}
