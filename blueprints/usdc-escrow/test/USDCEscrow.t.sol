// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "@blueprints-test/Mocks.sol";
import {USDCEscrow} from "../contracts/USDCEscrow.sol";

contract USDCEscrowTest is Test {
    MockUSDC internal usdc;
    USDCEscrow internal escrow;
    address internal buyer = makeAddr("buyer");
    address internal seller = makeAddr("seller");
    address internal arbiter = makeAddr("arbiter");

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new USDCEscrow(usdc);
        usdc.mint(buyer, 1_000e6);
        vm.prank(buyer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function _deal() internal returns (uint256) {
        vm.prank(buyer);
        return escrow.createDeal(seller, arbiter, 100e6, uint64(block.timestamp + 7 days), "Logo design");
    }

    function test_BuyerReleasesToSeller() public {
        uint256 dealId = _deal();
        vm.prank(buyer);
        escrow.release(dealId);
        assertEq(usdc.balanceOf(seller), 100e6);
        assertEq(uint8(escrow.getDeal(dealId).status), uint8(USDCEscrow.Status.Released));
    }

    function test_SellerRefunds() public {
        uint256 dealId = _deal();
        vm.prank(seller);
        escrow.refund(dealId);
        assertEq(usdc.balanceOf(buyer), 1_000e6);
    }

    function test_DisputeThenArbiterSplits() public {
        uint256 dealId = _deal();
        vm.prank(seller);
        escrow.dispute(dealId);

        vm.expectRevert(abi.encodeWithSelector(USDCEscrow.WrongStatus.selector, USDCEscrow.Status.Disputed));
        vm.prank(buyer);
        escrow.release(dealId);

        vm.prank(arbiter);
        escrow.settle(dealId, 30e6);
        assertEq(usdc.balanceOf(seller), 30e6);
        assertEq(usdc.balanceOf(buyer), 970e6);
    }

    function test_ReclaimOnlyAfterDeadline() public {
        uint256 dealId = _deal();
        vm.expectRevert(abi.encodeWithSelector(USDCEscrow.DeadlineNotReached.selector, uint64(block.timestamp + 7 days)));
        escrow.reclaim(dealId);

        vm.warp(block.timestamp + 7 days + 1);
        vm.expectRevert(abi.encodeWithSelector(USDCEscrow.DeadlinePassed.selector, uint64(block.timestamp - 1)));
        vm.prank(seller);
        escrow.dispute(dealId);

        escrow.reclaim(dealId);
        assertEq(usdc.balanceOf(buyer), 1_000e6);
    }

    function test_RevertWhen_CallerHasTheWrongRole() public {
        uint256 dealId = _deal();
        vm.expectRevert(USDCEscrow.NotBuyer.selector);
        vm.prank(seller);
        escrow.release(dealId);

        vm.expectRevert(USDCEscrow.NotArbiter.selector);
        vm.prank(buyer);
        escrow.settle(dealId, 0);

        vm.expectRevert(abi.encodeWithSelector(USDCEscrow.WrongStatus.selector, USDCEscrow.Status.Funded));
        vm.prank(arbiter);
        escrow.settle(dealId, 0);

        vm.expectRevert(USDCEscrow.InvalidParties.selector);
        vm.prank(buyer);
        escrow.createDeal(buyer, arbiter, 1, uint64(block.timestamp + 1), "");
    }
}

/// @dev Drives random sequences of deal actions and tracks what the escrow should hold.
contract EscrowHandler is Test {
    USDCEscrow internal immutable escrow;
    MockUSDC internal immutable usdc;
    address internal constant BUYER = address(0xB0B);
    address internal constant SELLER = address(0x5E11);
    address internal constant ARBITER = address(0xA4B);

    uint256[] internal dealIds;
    uint256 public outstanding;

    constructor(USDCEscrow escrow_, MockUSDC usdc_) {
        escrow = escrow_;
        usdc = usdc_;
    }

    function create(uint256 amount, uint256 daysOpen) external {
        amount = bound(amount, 1, 1_000_000e6);
        daysOpen = bound(daysOpen, 1, 30);
        usdc.mint(BUYER, amount);
        vm.startPrank(BUYER);
        usdc.approve(address(escrow), amount);
        dealIds.push(escrow.createDeal(SELLER, ARBITER, amount, uint64(block.timestamp + daysOpen * 1 days), ""));
        vm.stopPrank();
        outstanding += amount;
    }

    function release(uint256 seed) external {
        (bool found, uint256 id, USDCEscrow.Deal memory deal) = _pick(seed);
        if (!found || deal.status != USDCEscrow.Status.Funded) return;
        vm.prank(BUYER);
        escrow.release(id);
        outstanding -= deal.amount;
    }

    function refund(uint256 seed) external {
        (bool found, uint256 id, USDCEscrow.Deal memory deal) = _pick(seed);
        if (!found || deal.status != USDCEscrow.Status.Funded) return;
        vm.prank(SELLER);
        escrow.refund(id);
        outstanding -= deal.amount;
    }

    function dispute(uint256 seed) external {
        (bool found, uint256 id, USDCEscrow.Deal memory deal) = _pick(seed);
        if (!found || deal.status != USDCEscrow.Status.Funded || block.timestamp > deal.deadline) return;
        vm.prank(BUYER);
        escrow.dispute(id);
    }

    function settle(uint256 seed, uint256 toSeller) external {
        (bool found, uint256 id, USDCEscrow.Deal memory deal) = _pick(seed);
        if (!found || deal.status != USDCEscrow.Status.Disputed) return;
        vm.prank(ARBITER);
        escrow.settle(id, bound(toSeller, 0, deal.amount));
        outstanding -= deal.amount;
    }

    function reclaim(uint256 seed) external {
        (bool found, uint256 id, USDCEscrow.Deal memory deal) = _pick(seed);
        if (!found || deal.status != USDCEscrow.Status.Funded || block.timestamp <= deal.deadline) return;
        escrow.reclaim(id);
        outstanding -= deal.amount;
    }

    function passTime(uint256 secondsForward) external {
        vm.warp(block.timestamp + bound(secondsForward, 0, 10 days));
    }

    function _pick(uint256 seed) internal view returns (bool, uint256, USDCEscrow.Deal memory deal) {
        if (dealIds.length == 0) return (false, 0, deal);
        uint256 id = dealIds[seed % dealIds.length];
        return (true, id, escrow.getDeal(id));
    }
}

contract USDCEscrowInvariantTest is Test {
    MockUSDC internal usdc;
    USDCEscrow internal escrow;
    EscrowHandler internal handler;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new USDCEscrow(usdc);
        handler = new EscrowHandler(escrow, usdc);
        targetContract(address(handler));
    }

    /// The escrow always holds exactly what open (funded or disputed) deals are owed.
    function invariant_BalanceEqualsOpenDeals() public view {
        assertEq(usdc.balanceOf(address(escrow)), handler.outstanding());
    }
}
