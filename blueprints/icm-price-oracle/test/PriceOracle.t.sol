// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {TeleporterMessage} from "@teleporter/ITeleporterMessenger.sol";
import {TeleporterHarness} from "@blueprints-test/TeleporterHarness.sol";
import {MockAggregator} from "@blueprints-test/Mocks.sol";
import {PriceFeedPublisher} from "../contracts/PriceFeedPublisher.sol";
import {PriceFeedConsumer} from "../contracts/PriceFeedConsumer.sol";
import {PriceMessages} from "../contracts/PriceMessages.sol";

contract PriceOracleTest is TeleporterHarness {
    uint256 internal constant UPDATE_GAS = 200_000;
    uint256 internal constant REQUEST_GAS = 400_000;

    address internal owner = makeAddr("owner");
    MockAggregator internal aggregator;
    PriceFeedPublisher internal publisher;
    PriceFeedConsumer internal consumer;

    function setUp() public {
        vm.warp(10_000_000);
        _setUpTeleporters();
        aggregator = new MockAggregator();
        aggregator.set(11_36626900, block.timestamp - 60);
        publisher = new PriceFeedPublisher(cchainTeleporter, UPDATE_GAS, owner);
        consumer = new PriceFeedConsumer(l1Teleporter, CCHAIN, address(publisher), REQUEST_GAS, 1 days, owner);
        vm.startPrank(owner);
        publisher.setFeed("AVAX/USD", address(aggregator));
        publisher.setTrustedConsumer(L1, address(consumer), true);
        vm.stopPrank();
    }

    function test_PushedUpdateLandsWithinItsGasLimit() public {
        vm.recordLogs();
        publisher.publish("AVAX/USD", L1, address(consumer));
        (TeleporterMessage memory update,) = _lastSent();
        assertLt(_deliver(l1Teleporter, CCHAIN, update), UPDATE_GAS);
        assertEq(consumer.latestPrice("AVAX/USD").answer, 11_36626900);
    }

    function test_RequestIsAnsweredWithinTheRequestGasLimit() public {
        vm.recordLogs();
        consumer.requestPrice("AVAX/USD");
        (TeleporterMessage memory request,) = _lastSent();

        vm.recordLogs();
        assertLt(_deliver(cchainTeleporter, L1, request), REQUEST_GAS);
        (TeleporterMessage memory answer,) = _lastSent();
        _deliver(l1Teleporter, CCHAIN, answer);
        assertEq(consumer.latestPrice("AVAX/USD").answer, 11_36626900);
    }

    function test_OlderRoundsNeverOverwriteNewerOnes() public {
        vm.recordLogs();
        publisher.publish("AVAX/USD", L1, address(consumer));
        (TeleporterMessage memory older,) = _lastSent();

        aggregator.set(12_00000000, block.timestamp);
        vm.recordLogs();
        publisher.publish("AVAX/USD", L1, address(consumer));
        (TeleporterMessage memory newer,) = _lastSent();

        _deliver(l1Teleporter, CCHAIN, newer);
        _deliver(l1Teleporter, CCHAIN, older);
        assertEq(consumer.latestPrice("AVAX/USD").answer, 12_00000000);
    }

    function test_RevertWhen_StaleOrUntrusted() public {
        vm.recordLogs();
        publisher.publish("AVAX/USD", L1, address(consumer));
        (TeleporterMessage memory update,) = _lastSent();
        _deliver(l1Teleporter, CCHAIN, update);

        vm.warp(block.timestamp + 2 days);
        vm.expectRevert();
        consumer.latestPrice("AVAX/USD");

        address impostor = makeAddr("impostor");
        vm.expectRevert(abi.encodeWithSelector(PriceFeedConsumer.UntrustedPublisher.selector, CCHAIN, impostor));
        vm.prank(address(l1Teleporter));
        consumer.receiveTeleporterMessage(CCHAIN, impostor, update.message);

        vm.expectRevert(abi.encodeWithSelector(PriceFeedPublisher.UntrustedConsumer.selector, L1, impostor));
        publisher.publish("AVAX/USD", L1, impostor);

        vm.expectRevert(abi.encodeWithSelector(PriceFeedPublisher.UnexpectedMessage.selector, PriceMessages.UPDATE));
        vm.prank(address(cchainTeleporter));
        publisher.receiveTeleporterMessage(L1, address(consumer), update.message);
    }
}
