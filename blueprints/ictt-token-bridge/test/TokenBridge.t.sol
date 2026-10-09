// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {TeleporterMessage} from "@teleporter/ITeleporterMessenger.sol";
import {TeleporterHarness, TokenRemoteSettings} from "@blueprints-test/TeleporterHarness.sol";
import {MockToken} from "@blueprints-test/Mocks.sol";

/// @dev The ICTT send entry point shared by TokenHome and TokenRemote.
interface ITokenTransferrer {
    struct SendTokensInput {
        bytes32 destinationBlockchainID;
        address destinationTokenTransferrerAddress;
        address recipient;
        address primaryFeeTokenAddress;
        uint256 primaryFee;
        uint256 secondaryFee;
        uint256 requiredGasLimit;
        address multiHopFallback;
    }

    function send(SendTokensInput calldata input, uint256 amount) external;
}

/// Exercises the blueprint's steps against the audited ICTT bytecode in contracts/icm-contracts/compiled.
contract TokenBridgeTest is TeleporterHarness {
    uint256 internal constant GAS_LIMIT = 250_000;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    MockToken internal token;
    address internal home;
    address internal remote;

    function setUp() public {
        _setUpTeleporters();
        address cchainRegistry = _deployRegistry(CCHAIN, cchainTeleporter);
        address l1Registry = _deployRegistry(L1, l1Teleporter);
        token = new MockToken("MOON");
        token.mint(alice, 100e18);
        home = _deployTokenHome(CCHAIN, cchainRegistry, owner, address(token), 18);
        remote = _deployTokenRemote(
            L1,
            TokenRemoteSettings({
                teleporterRegistryAddress: l1Registry,
                teleporterManager: owner,
                minTeleporterVersion: 1,
                tokenHomeBlockchainID: CCHAIN,
                tokenHomeAddress: home,
                tokenHomeDecimals: 18
            }),
            "Moon (Bridged)",
            "MOON.b",
            18
        );
    }

    function _input(bytes32 destination, address transferrer) internal view returns (ITokenTransferrer.SendTokensInput memory) {
        return ITokenTransferrer.SendTokensInput({
            destinationBlockchainID: destination,
            destinationTokenTransferrerAddress: transferrer,
            recipient: alice,
            primaryFeeTokenAddress: address(0),
            primaryFee: 0,
            secondaryFee: 0,
            requiredGasLimit: GAS_LIMIT,
            multiHopFallback: address(0)
        });
    }

    function test_RegisterSendAndReturn() public {
        _registerRemote(remote, cchainTeleporter, L1);

        vm.startPrank(alice);
        token.approve(home, 10e18);
        vm.recordLogs();
        ITokenTransferrer(home).send(_input(L1, remote), 10e18);
        vm.stopPrank();
        (TeleporterMessage memory outbound,) = _lastSent();
        assertLt(_deliver(l1Teleporter, CCHAIN, outbound), GAS_LIMIT);
        assertEq(IERC20(remote).balanceOf(alice), 10e18);
        assertEq(token.balanceOf(home), 10e18);

        // The remote pulls the bridged tokens from the caller, so the caller approves the remote itself.
        vm.startPrank(alice);
        IERC20(remote).approve(remote, 4e18);
        vm.recordLogs();
        ITokenTransferrer(remote).send(_input(CCHAIN, home), 4e18);
        vm.stopPrank();
        (TeleporterMessage memory inbound,) = _lastSent();
        _deliver(cchainTeleporter, L1, inbound);
        assertEq(token.balanceOf(alice), 94e18);
        assertEq(IERC20(remote).balanceOf(alice), 6e18);
    }

    function test_RevertWhen_SendingBeforeRegistrationArrives() public {
        vm.startPrank(alice);
        token.approve(home, 1e18);
        vm.expectRevert();
        ITokenTransferrer(home).send(_input(L1, remote), 1e18);
        vm.stopPrank();
    }
}
