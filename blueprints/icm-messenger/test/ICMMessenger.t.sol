// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {TeleporterMessage, TeleporterFeeInfo} from "@teleporter/ITeleporterMessenger.sol";
import {TeleporterHarness} from "@blueprints-test/TeleporterHarness.sol";
import {MockToken} from "@blueprints-test/Mocks.sol";
import {ICMMessenger} from "../contracts/ICMMessenger.sol";

contract ICMMessengerTest is TeleporterHarness {
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    ICMMessenger internal onCChain;
    ICMMessenger internal onL1;

    function setUp() public {
        _setUpTeleporters();
        onCChain = new ICMMessenger(cchainTeleporter, owner);
        onL1 = new ICMMessenger(l1Teleporter, owner);
        vm.startPrank(owner);
        onCChain.setTrustedRemote(L1, address(onL1), true);
        onL1.setTrustedRemote(CCHAIN, address(onCChain), true);
        vm.stopPrank();
    }

    function test_RoundTripWithMaximumMessageFitsDefaultGas() public {
        vm.recordLogs();
        vm.prank(alice);
        onCChain.sendMessage(L1, address(onL1), string(new bytes(280)), address(0), 0, 0);
        (TeleporterMessage memory message,) = _lastSent();
        assertEq(message.requiredGasLimit, onCChain.DEFAULT_GAS_LIMIT());

        uint256 used = _deliver(l1Teleporter, CCHAIN, message);
        assertLt(used, onCChain.DEFAULT_GAS_LIMIT());
        ICMMessenger.Received memory received = onL1.lastMessage();
        assertEq(received.author, alice);
        assertEq(received.sender, address(onCChain));
        assertEq(received.sourceBlockchainID, CCHAIN);
        assertEq(onL1.receivedCount(), 1);

        vm.recordLogs();
        vm.prank(alice);
        onL1.sendMessage(CCHAIN, address(onCChain), "pong", address(0), 0, 0);
        (TeleporterMessage memory reply,) = _lastSent();
        _deliver(cchainTeleporter, L1, reply);
        assertEq(onCChain.lastMessage().message, "pong");
    }

    function test_RevertWhen_CallerOrOriginIsUntrusted() public {
        vm.expectRevert(abi.encodeWithSelector(ICMMessenger.UnauthorizedMessenger.selector, alice));
        vm.prank(alice);
        onL1.receiveTeleporterMessage(CCHAIN, address(onCChain), abi.encode(alice, "spoof"));

        address impostor = makeAddr("impostor");
        vm.expectRevert(abi.encodeWithSelector(ICMMessenger.UntrustedRemote.selector, CCHAIN, impostor));
        vm.prank(address(l1Teleporter));
        onL1.receiveTeleporterMessage(CCHAIN, impostor, abi.encode(alice, "spoof"));

        vm.expectRevert(abi.encodeWithSelector(ICMMessenger.UntrustedRemote.selector, L1, impostor));
        vm.prank(alice);
        onCChain.sendMessage(L1, impostor, "hi", address(0), 0, 0);
    }

    function test_PaysRelayerFeesInAnErc20() public {
        MockToken fee = new MockToken("FEE");
        fee.mint(alice, 10e18);
        vm.startPrank(alice);
        fee.approve(address(onCChain), 1e18);
        vm.recordLogs();
        onCChain.sendMessage(L1, address(onL1), "paid", address(fee), 1e18, 0);
        vm.stopPrank();
        (, TeleporterFeeInfo memory feeInfo) = _lastSent();
        assertEq(feeInfo.feeTokenAddress, address(fee));
        assertEq(feeInfo.amount, 1e18);
        assertEq(fee.balanceOf(address(cchainTeleporter)), 1e18);
    }
}
