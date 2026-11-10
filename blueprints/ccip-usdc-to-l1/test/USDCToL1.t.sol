// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
import {TeleporterMessage} from "@teleporter/ITeleporterMessenger.sol";
import {TeleporterHarness, TokenRemoteSettings} from "@blueprints-test/TeleporterHarness.sol";
import {MockCCIPRouter} from "@blueprints-test/MockCCIPRouter.sol";
import {MockUSDC} from "@blueprints-test/Mocks.sol";
import {L1Gateway, IERC20TokenHome} from "../contracts/L1Gateway.sol";
import {USDCToL1Sender} from "../contracts/USDCToL1Sender.sol";

/// End to end: USDC leaves a CCIP chain, lands in the gateway on the C-Chain, and is forwarded through the
/// real ICTT TokenHome and Teleporter to a TokenRemote on the L1.
contract USDCToL1Test is TeleporterHarness {
    uint64 internal constant SOURCE = 10344971235874465080;
    uint64 internal constant HUB = 14767482510784806043;
    uint256 internal constant L1_GAS = 250_000;
    uint256 internal constant GATEWAY_GAS = 500_000;
    bytes internal constant EXTRA_ARGS = hex"181dcf10";

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    MockCCIPRouter internal sourceRouter;
    MockCCIPRouter internal hubRouter;
    MockUSDC internal sourceUsdc;
    MockUSDC internal hubUsdc;
    address internal l1Registry;
    address internal home;
    address internal remote;
    L1Gateway internal gateway;
    USDCToL1Sender internal sender;

    function setUp() public {
        _setUpTeleporters();
        address cchainRegistry = _deployRegistry(CCHAIN, cchainTeleporter);
        l1Registry = _deployRegistry(L1, l1Teleporter);
        hubUsdc = new MockUSDC();
        sourceUsdc = new MockUSDC();
        home = _deployTokenHome(CCHAIN, cchainRegistry, owner, address(hubUsdc), 6);
        remote = _newRemote();
        _registerRemote(remote, cchainTeleporter, L1);

        sourceRouter = new MockCCIPRouter();
        hubRouter = new MockCCIPRouter();
        gateway = _newGateway(remote);
        sender = new USDCToL1Sender(address(sourceRouter), sourceUsdc, HUB, address(gateway), owner);
        vm.prank(owner);
        gateway.allowlistSender(SOURCE, address(sender), true);

        sourceUsdc.mint(alice, 100e6);
        vm.deal(alice, 1 ether);
        hubUsdc.mint(address(hubRouter), 1_000e6);
    }

    function _newRemote() internal returns (address) {
        return _deployTokenRemote(
            L1,
            TokenRemoteSettings({
                teleporterRegistryAddress: l1Registry,
                teleporterManager: owner,
                minTeleporterVersion: 1,
                tokenHomeBlockchainID: CCHAIN,
                tokenHomeAddress: home,
                tokenHomeDecimals: 6
            }),
            "USD Coin (Bridged)",
            "USDC.b",
            6
        );
    }

    function _newGateway(address tokenRemote) internal returns (L1Gateway) {
        return new L1Gateway(address(hubRouter), hubUsdc, IERC20TokenHome(home), L1, tokenRemote, L1_GAS, owner);
    }

    function _sendFromSource(uint256 amount) internal returns (bytes32 messageId) {
        uint256 fee = sourceRouter.FEE();
        vm.startPrank(alice);
        sourceUsdc.approve(address(sender), amount);
        messageId = sender.sendToL1{value: fee}(alice, amount, address(0), EXTRA_ARGS);
        vm.stopPrank();
    }

    function _arrival(bytes32 messageId, uint256 amount, address from, address token)
        internal
        view
        returns (Client.Any2EVMMessage memory)
    {
        Client.EVMTokenAmount[] memory tokens = new Client.EVMTokenAmount[](1);
        tokens[0] = Client.EVMTokenAmount({token: token, amount: amount});
        return Client.Any2EVMMessage({
            messageId: messageId,
            sourceChainSelector: SOURCE,
            sender: abi.encode(from),
            data: sourceRouter.lastMessage().data,
            destTokenAmounts: tokens
        });
    }

    function test_UsdcFromACcipChainLandsOnTheL1() public {
        bytes32 id = _sendFromSource(25e6);
        assertEq(sourceUsdc.balanceOf(address(sourceRouter)), 25e6);

        vm.recordLogs();
        uint256 before = gasleft();
        hubRouter.deliverWithTokens(address(gateway), _arrival(id, 25e6, address(sender), address(hubUsdc)), address(hubUsdc), 25e6);
        assertLt(before - gasleft(), GATEWAY_GAS);
        assertEq(uint8(gateway.transferOf(id).status), uint8(L1Gateway.Status.Forwarded));

        (TeleporterMessage memory ictt,) = _lastSent();
        assertLt(_deliver(l1Teleporter, CCHAIN, ictt), L1_GAS);
        assertEq(IERC20(remote).balanceOf(alice), 25e6);
        assertEq(hubUsdc.balanceOf(home), 25e6);
        assertEq(hubUsdc.balanceOf(address(gateway)), 0);
    }

    function test_HeldWhileTheL1BridgeIsNotReady_ThenRetried() public {
        address unregistered = _newRemote();
        L1Gateway pending = _newGateway(unregistered);
        vm.prank(owner);
        pending.allowlistSender(SOURCE, address(sender), true);

        bytes32 id = _sendFromSource(5e6);
        hubRouter.deliverWithTokens(address(pending), _arrival(id, 5e6, address(sender), address(hubUsdc)), address(hubUsdc), 5e6);
        assertEq(uint8(pending.transferOf(id).status), uint8(L1Gateway.Status.Held));
        assertEq(hubUsdc.balanceOf(address(pending)), 5e6);

        _registerRemote(unregistered, cchainTeleporter, L1);
        vm.recordLogs();
        pending.retry(id);
        assertEq(uint8(pending.transferOf(id).status), uint8(L1Gateway.Status.Forwarded));
        (TeleporterMessage memory ictt,) = _lastSent();
        _deliver(l1Teleporter, CCHAIN, ictt);
        assertEq(IERC20(unregistered).balanceOf(alice), 5e6);
    }

    function test_HeldTransferCanBeRefundedOnTheCChain() public {
        L1Gateway pending = _newGateway(_newRemote());
        vm.prank(owner);
        pending.allowlistSender(SOURCE, address(sender), true);

        bytes32 id = _sendFromSource(7e6);
        hubRouter.deliverWithTokens(address(pending), _arrival(id, 7e6, address(sender), address(hubUsdc)), address(hubUsdc), 7e6);

        address mallory = makeAddr("mallory");
        vm.expectRevert(abi.encodeWithSelector(L1Gateway.NotRecipient.selector, mallory));
        vm.prank(mallory);
        pending.refundHeld(id, mallory);

        vm.prank(alice);
        pending.refundHeld(id, alice);
        assertEq(hubUsdc.balanceOf(alice), 7e6);
        vm.expectRevert(abi.encodeWithSelector(L1Gateway.NotHeld.selector, id));
        vm.prank(alice);
        pending.refundHeld(id, alice);
    }

    function test_RevertWhen_SenderTokenOrCallerIsUnexpected() public {
        bytes32 id = _sendFromSource(1e6);
        address impostor = makeAddr("impostor");
        // Built up front: vm.expectRevert applies to the next external call, including ones made
        // while evaluating arguments.
        Client.Any2EVMMessage memory fromImpostor = _arrival(id, 1e6, impostor, address(hubUsdc));
        Client.Any2EVMMessage memory wrongToken = _arrival(id, 1e6, address(sender), address(sourceUsdc));
        Client.Any2EVMMessage memory valid = _arrival(id, 1e6, address(sender), address(hubUsdc));

        vm.expectRevert(abi.encodeWithSelector(L1Gateway.SenderNotAllowed.selector, SOURCE, impostor));
        hubRouter.deliverWithTokens(address(gateway), fromImpostor, address(hubUsdc), 1e6);

        vm.expectRevert(L1Gateway.UnexpectedTokens.selector);
        hubRouter.deliver(address(gateway), wrongToken);

        vm.expectRevert(abi.encodeWithSelector(CCIPReceiver.InvalidRouter.selector, alice));
        vm.prank(alice);
        gateway.ccipReceive(valid);

        hubRouter.deliverWithTokens(address(gateway), valid, address(hubUsdc), 1e6);
        vm.expectRevert(abi.encodeWithSelector(L1Gateway.AlreadyProcessed.selector, id));
        hubRouter.deliverWithTokens(address(gateway), valid, address(hubUsdc), 1e6);
    }
}
