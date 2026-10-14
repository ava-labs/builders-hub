// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MockUSDC} from "@blueprints-test/Mocks.sol";
import {USDCCheckout} from "../contracts/USDCCheckout.sol";

contract USDCCheckoutTest is Test {
    bytes32 internal constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    MockUSDC internal usdc;
    USDCCheckout internal shop;
    address internal owner = makeAddr("owner");
    address internal buyer;
    uint256 internal buyerKey;

    function setUp() public {
        usdc = new MockUSDC();
        shop = new USDCCheckout(usdc, owner);
        (buyer, buyerKey) = makeAddrAndKey("buyer");
        usdc.mint(buyer, 1_000e6);
        vm.prank(owner);
        shop.setProduct(1, "Hoodie", 25e6, true);
    }

    function test_PurchaseRefundWithdraw() public {
        vm.startPrank(buyer);
        usdc.approve(address(shop), 50e6);
        uint256 orderId = shop.purchase(1, 2, bytes32("cart-42"));
        vm.stopPrank();

        assertEq(orderId, 1);
        assertEq(usdc.balanceOf(address(shop)), 50e6);
        USDCCheckout.Order memory paid = shop.getOrder(orderId);
        assertEq(paid.buyer, buyer);
        assertEq(paid.amount, 50e6);
        assertEq(uint8(paid.status), uint8(USDCCheckout.OrderStatus.Paid));
        assertEq(paid.orderRef, bytes32("cart-42"));

        vm.prank(owner);
        shop.refund(orderId);
        assertEq(usdc.balanceOf(buyer), 1_000e6);
        vm.expectRevert(abi.encodeWithSelector(USDCCheckout.NotRefundable.selector, orderId));
        vm.prank(owner);
        shop.refund(orderId);

        vm.startPrank(buyer);
        usdc.approve(address(shop), 25e6);
        shop.purchase(1, 1, bytes32(0));
        vm.stopPrank();
        vm.prank(owner);
        shop.withdraw(owner, 25e6);
        assertEq(usdc.balanceOf(owner), 25e6);
    }

    function test_PurchaseWithPermitInOneTransaction() public {
        uint256 amount = shop.priceOf(1, 1);
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, buyer, address(shop), amount, usdc.nonces(buyer), deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", usdc.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(buyerKey, digest);

        vm.prank(buyer);
        uint256 orderId = shop.purchaseWithPermit(1, 1, bytes32("permit"), deadline, v, r, s);
        assertEq(shop.getOrder(orderId).amount, amount);
        assertEq(usdc.balanceOf(address(shop)), amount);
    }

    function test_RevertWhen_ProductQuantityPauseOrOwnerRulesBroken() public {
        vm.prank(owner);
        shop.setProduct(2, "Retired", 10e6, false);
        vm.expectRevert(abi.encodeWithSelector(USDCCheckout.ProductUnavailable.selector, 2));
        vm.prank(buyer);
        shop.purchase(2, 1, bytes32(0));

        vm.expectRevert(abi.encodeWithSelector(USDCCheckout.InvalidQuantity.selector, 0));
        vm.prank(buyer);
        shop.purchase(1, 0, bytes32(0));

        vm.prank(owner);
        shop.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(buyer);
        shop.purchase(1, 1, bytes32(0));

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, buyer));
        vm.prank(buyer);
        shop.withdraw(buyer, 1);
    }

    function testFuzz_ChargesExactlyPriceTimesQuantity(uint256 quantity, uint96 price) public {
        quantity = bound(quantity, 1, shop.MAX_QUANTITY());
        price = uint96(bound(price, 1, 1_000_000e6));
        vm.prank(owner);
        shop.setProduct(7, "Fuzzed", price, true);

        uint256 total = uint256(price) * quantity;
        usdc.mint(buyer, total);
        vm.startPrank(buyer);
        usdc.approve(address(shop), total);
        uint256 before = usdc.balanceOf(buyer);
        uint256 orderId = shop.purchase(7, quantity, bytes32(0));
        vm.stopPrank();

        assertEq(before - usdc.balanceOf(buyer), total);
        assertEq(shop.getOrder(orderId).amount, total);
    }
}
