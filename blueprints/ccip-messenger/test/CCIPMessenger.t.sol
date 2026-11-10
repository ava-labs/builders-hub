// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {MockCCIPRouter} from "@blueprints-test/MockCCIPRouter.sol";
import {CCIPMessenger} from "../contracts/CCIPMessenger.sol";

contract CCIPMessengerTest is Test {
    uint64 internal constant FUJI = 14767482510784806043;
    uint64 internal constant SEPOLIA = 16015286601757825753;

    MockCCIPRouter internal router;
    CCIPMessenger internal onFuji;
    CCIPMessenger internal onSepolia;
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    function setUp() public {
        router = new MockCCIPRouter();
        onFuji = new CCIPMessenger(address(router), owner);
        onSepolia = new CCIPMessenger(address(router), owner);
        vm.startPrank(owner);
        onFuji.allowlistDestinationChain(SEPOLIA, true);
        onSepolia.allowlistSender(FUJI, address(onFuji), true);
        vm.stopPrank();
        vm.deal(alice, 1 ether);
    }

    function test_SendThenDeliverWithinTheDefaultGas() public {
        uint256 fee = router.FEE();
        vm.prank(alice);
        bytes32 messageId = onFuji.sendMessage{value: fee}(SEPOLIA, address(onSepolia), string(new bytes(280)), address(0), "");

        uint256 before = gasleft();
        router.deliver(
            address(onSepolia),
            Client.Any2EVMMessage({
                messageId: messageId,
                sourceChainSelector: FUJI,
                sender: abi.encode(address(onFuji)),
                data: router.lastMessage().data,
                destTokenAmounts: new Client.EVMTokenAmount[](0)
            })
        );
        assertLt(before - gasleft(), 300_000);

        CCIPMessenger.Received memory received = onSepolia.lastMessage();
        assertEq(received.author, alice);
        assertEq(received.sender, address(onFuji));
        assertEq(onSepolia.receivedCount(), 1);
    }

    function test_RevertWhen_SenderOrCallerIsUnknown() public {
        address impostor = makeAddr("impostor");
        Client.Any2EVMMessage memory spoof = Client.Any2EVMMessage({
            messageId: bytes32(uint256(1)),
            sourceChainSelector: FUJI,
            sender: abi.encode(impostor),
            data: abi.encode(alice, "spoof"),
            destTokenAmounts: new Client.EVMTokenAmount[](0)
        });

        vm.expectRevert(abi.encodeWithSelector(CCIPMessenger.SenderNotAllowed.selector, FUJI, impostor));
        router.deliver(address(onSepolia), spoof);

        vm.expectRevert(abi.encodeWithSelector(CCIPReceiver.InvalidRouter.selector, alice));
        vm.prank(alice);
        onSepolia.ccipReceive(spoof);

        vm.expectRevert(abi.encodeWithSelector(CCIPMessenger.SenderNotAllowed.selector, FUJI, impostor));
        onSepolia.getCCVsAndFinalityConfig(FUJI, abi.encode(impostor));

        (,,, bytes4 finality) = onSepolia.getCCVsAndFinalityConfig(FUJI, abi.encode(address(onFuji)));
        assertEq(finality, bytes4(0));
    }
}
