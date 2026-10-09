// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "@blueprints-test/Mocks.sol";
import {CreatorTips} from "../contracts/CreatorTips.sol";

contract CreatorTipsTest is Test {
    MockUSDC internal usdc;
    CreatorTips internal tips;
    address internal creator = makeAddr("creator");
    address internal fan = makeAddr("fan");

    function setUp() public {
        usdc = new MockUSDC();
        tips = new CreatorTips(usdc);
        vm.prank(creator);
        tips.register("ava_labs", "Ava", "Builds things", "ipfs://avatar");
    }

    function test_TipGoesStraightToCreator() public {
        usdc.mint(fan, 10e6);
        vm.startPrank(fan);
        usdc.approve(address(tips), 3e6);
        tips.tip("ava_labs", 3e6, "gm");
        vm.stopPrank();

        assertEq(usdc.balanceOf(creator), 3e6);
        assertEq(usdc.balanceOf(address(tips)), 0);
        CreatorTips.Profile memory profile = tips.profileOf(creator);
        assertEq(profile.tipsReceived, 3e6);
        assertEq(profile.tipCount, 1);
    }

    function test_RevertWhen_HandleOrTipRulesBroken() public {
        vm.expectRevert(abi.encodeWithSelector(CreatorTips.InvalidHandle.selector, "Alice"));
        vm.prank(fan);
        tips.register("Alice", "", "", "");

        vm.expectRevert(abi.encodeWithSelector(CreatorTips.InvalidHandle.selector, "al"));
        vm.prank(fan);
        tips.register("al", "", "", "");

        vm.expectRevert(abi.encodeWithSelector(CreatorTips.HandleTaken.selector, "ava_labs"));
        vm.prank(fan);
        tips.register("ava_labs", "", "", "");

        vm.expectRevert(abi.encodeWithSelector(CreatorTips.AlreadyRegistered.selector, creator));
        vm.prank(creator);
        tips.register("second_handle", "", "", "");

        vm.expectRevert(CreatorTips.SelfTip.selector);
        vm.prank(creator);
        tips.tip("ava_labs", 1, "");

        vm.expectRevert(abi.encodeWithSelector(CreatorTips.UnknownHandle.selector, "nobody"));
        vm.prank(fan);
        tips.tip("nobody", 1, "");
    }

    function testFuzz_OnlyLowercaseDigitsAndUnderscoreAreValid(bytes32 seed) public {
        bytes memory handle = new bytes(8);
        bool valid = true;
        for (uint256 i = 0; i < 8; ++i) {
            bytes1 char = seed[i];
            handle[i] = char;
            bool allowed = (char >= 0x61 && char <= 0x7a) || (char >= 0x30 && char <= 0x39) || char == 0x5f;
            valid = valid && allowed;
        }
        // Keep the character property independent of the "ava_labs" fixture in setUp:
        // a syntactically valid fuzzed handle may legitimately collide with that profile.
        CreatorTips isolated = new CreatorTips(usdc);
        address newcomer = makeAddr("newcomer");
        vm.prank(newcomer);
        if (!valid) vm.expectRevert(abi.encodeWithSelector(CreatorTips.InvalidHandle.selector, string(handle)));
        isolated.register(string(handle), "", "", "");
    }
}
