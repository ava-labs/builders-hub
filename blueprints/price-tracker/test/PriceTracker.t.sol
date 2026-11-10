// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Test} from "forge-std/Test.sol";
import {MockAggregator} from "@blueprints-test/Mocks.sol";
import {PriceTracker} from "../contracts/PriceTracker.sol";

contract PriceTrackerTest is Test {
    address internal owner = makeAddr("owner");
    MockAggregator internal aggregator;
    PriceTracker internal tracker;

    function setUp() public {
        vm.warp(1_000_000);
        aggregator = new MockAggregator();
        tracker = new PriceTracker(owner);
        vm.prank(owner);
        tracker.setFeed("AVAX/USD", address(aggregator), 3600);
    }

    function test_ReadsAndQuotesFreshPrice() public {
        aggregator.set(11_36626900, block.timestamp - 60);
        PriceTracker.Price memory price = tracker.latestPrice("AVAX/USD");
        assertEq(price.answer, 11_36626900);
        assertEq(price.decimals, 8);

        (uint256 value, uint8 valueDecimals) = tracker.quote("AVAX/USD", 2e18, 18);
        assertEq(value, 2 * 11_36626900);
        assertEq(valueDecimals, 8);

        string[] memory pairs = new string[](1);
        pairs[0] = "AVAX/USD";
        assertEq(tracker.latestPrices(pairs)[0].answer, 11_36626900);
    }

    function test_RevertWhen_StaleNegativeOrUnknown() public {
        uint256 old = block.timestamp - 3601;
        aggregator.set(100, old);
        vm.expectRevert(abi.encodeWithSelector(PriceTracker.StalePrice.selector, "AVAX/USD", old, uint32(3600)));
        tracker.latestPrice("AVAX/USD");

        aggregator.set(-1, block.timestamp);
        vm.expectRevert(abi.encodeWithSelector(PriceTracker.InvalidPrice.selector, "AVAX/USD", int256(-1)));
        tracker.latestPrice("AVAX/USD");

        vm.expectRevert(abi.encodeWithSelector(PriceTracker.UnknownPair.selector, "ETH/USD"));
        tracker.latestPrice("ETH/USD");
    }

    function test_RepointingKeepsOnePair() public {
        MockAggregator replacement = new MockAggregator();
        vm.prank(owner);
        tracker.setFeed("AVAX/USD", address(replacement), 60);
        assertEq(tracker.listPairs().length, 1);
        (address current, uint32 maxAge) = tracker.feedOf("AVAX/USD");
        assertEq(current, address(replacement));
        assertEq(maxAge, 60);
    }

    function testFuzz_QuoteScalesLinearly(uint96 amount, uint64 answer) public {
        answer = uint64(bound(answer, 1, type(uint64).max));
        aggregator.set(int256(uint256(answer)), block.timestamp);
        (uint256 value,) = tracker.quote("AVAX/USD", amount, 18);
        assertEq(value, (uint256(amount) * answer) / 1e18);
    }
}
