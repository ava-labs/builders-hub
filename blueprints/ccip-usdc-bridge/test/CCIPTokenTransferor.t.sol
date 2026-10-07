// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {MockCCIPRouter} from "@blueprints-test/MockCCIPRouter.sol";
import {MockUSDC, MockToken} from "@blueprints-test/Mocks.sol";
import {CCIPTokenTransferor} from "../contracts/CCIPTokenTransferor.sol";

contract CCIPTokenTransferorTest is Test {
    uint64 internal constant SEPOLIA = 16015286601757825753;
    bytes internal constant EXTRA_ARGS = hex"181dcf10";

    MockCCIPRouter internal router;
    CCIPTokenTransferor internal transferor;
    MockUSDC internal usdc;
    MockToken internal link;
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    function setUp() public {
        router = new MockCCIPRouter();
        transferor = new CCIPTokenTransferor(address(router), owner);
        usdc = new MockUSDC();
        link = new MockToken("LINK");
        usdc.mint(alice, 100e6);
        link.mint(alice, 1 ether);
        vm.deal(alice, 1 ether);
        vm.prank(owner);
        transferor.allowlistDestinationChain(SEPOLIA, true);
    }

    function test_NativeFeeRefundsTheExcess() public {
        uint256 fee = router.FEE();
        vm.startPrank(alice);
        usdc.approve(address(transferor), 10e6);
        transferor.transferTokens{value: 0.05 ether}(SEPOLIA, alice, address(usdc), 10e6, address(0), EXTRA_ARGS);
        vm.stopPrank();

        assertEq(usdc.balanceOf(address(router)), 10e6);
        assertEq(address(router).balance, fee);
        assertEq(alice.balance, 1 ether - fee);
        assertEq(address(transferor).balance, 0);
        Client.EVM2AnyMessage memory sent = router.lastMessage();
        assertEq(abi.decode(sent.receiver, (address)), alice);
        assertEq(sent.extraArgs, EXTRA_ARGS);
    }

    function test_Erc20FeeAndSameTokenFee() public {
        uint256 fee = router.FEE();
        vm.startPrank(alice);
        usdc.approve(address(transferor), 10e6);
        link.approve(address(transferor), fee);
        transferor.transferTokens(SEPOLIA, alice, address(usdc), 10e6, address(link), EXTRA_ARGS);

        link.approve(address(transferor), 0.5 ether + fee);
        transferor.transferTokens(SEPOLIA, alice, address(link), 0.5 ether, address(link), EXTRA_ARGS);
        vm.stopPrank();

        assertEq(link.balanceOf(address(router)), 2 * fee + 0.5 ether);
        assertEq(link.balanceOf(address(transferor)), 0);
    }

    function test_RevertWhen_LaneFeeOrValueIsWrong() public {
        uint256 fee = router.FEE();
        vm.expectRevert(abi.encodeWithSelector(CCIPTokenTransferor.DestinationChainNotAllowed.selector, uint64(1)));
        vm.prank(alice);
        transferor.transferTokens(1, alice, address(usdc), 1, address(0), EXTRA_ARGS);

        vm.expectRevert(abi.encodeWithSelector(CCIPTokenTransferor.InsufficientNativeForFees.selector, 0, fee));
        vm.prank(alice);
        transferor.transferTokens(SEPOLIA, alice, address(usdc), 1, address(0), EXTRA_ARGS);

        vm.expectRevert(abi.encodeWithSelector(CCIPTokenTransferor.UnexpectedNativeValue.selector, 1));
        vm.prank(alice);
        transferor.transferTokens{value: 1}(SEPOLIA, alice, address(usdc), 1, address(link), EXTRA_ARGS);
    }
}
