// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {TeleporterMessage} from "@teleporter/ITeleporterMessenger.sol";
import {TeleporterHarness} from "@blueprints-test/TeleporterHarness.sol";
import {IdentityHub} from "../contracts/IdentityHub.sol";
import {IdentityGate} from "../contracts/IdentityGate.sol";
import {IdentityMessages} from "../contracts/IdentityMessages.sol";
import {CompliantToken} from "../contracts/CompliantToken.sol";

contract IdentityLayerTest is TeleporterHarness {
    bytes32 internal constant KYC = keccak256("KYC_VERIFIED");
    uint256 internal constant DELIVERY_GAS = 150_000;

    address internal owner = makeAddr("owner");
    address internal issuer = makeAddr("issuer");
    address internal alice = makeAddr("alice");
    address internal aliceOnL1 = makeAddr("aliceOnL1");
    address internal bob = makeAddr("bob");

    IdentityHub internal hub;
    IdentityGate internal gate;

    function setUp() public {
        vm.warp(1_000_000);
        _setUpTeleporters();
        hub = new IdentityHub(cchainTeleporter, DELIVERY_GAS, owner);
        gate = new IdentityGate(l1Teleporter, CCHAIN, address(hub));
        vm.startPrank(owner);
        hub.setIssuer(issuer, true);
        hub.setTrustedGate(L1, address(gate), true);
        vm.stopPrank();
    }

    function _attest(address subject, uint64 lifetime) internal {
        vm.prank(issuer);
        hub.attest(subject, KYC, uint64(block.timestamp) + lifetime, keccak256("evidence-record-and-salt"));
    }

    function _share(address subject, address account) internal returns (TeleporterMessage memory message) {
        vm.recordLogs();
        vm.prank(subject);
        hub.share(KYC, L1, address(gate), account);
        (message,) = _lastSent();
    }

    function test_ShareDisclosesOnlyAccountClaimAndExpiry() public {
        _attest(alice, 30 days);
        TeleporterMessage memory message = _share(alice, aliceOnL1);

        (uint8 kind, address account, bytes32 claimType, uint64 expiresAt,) = IdentityMessages.decode(message.message);
        assertEq(kind, IdentityMessages.SHARE);
        assertEq(account, aliceOnL1);
        assertEq(claimType, KYC);
        assertEq(expiresAt, block.timestamp + 30 days);
        // Five words: no subject address, evidence, or issuer crosses chains.
        assertEq(message.message.length, 5 * 32);

        assertLt(_deliver(l1Teleporter, CCHAIN, message), DELIVERY_GAS);
        assertTrue(gate.hasClaim(aliceOnL1, KYC));
        assertFalse(gate.hasClaim(alice, KYC));
    }

    function test_RevocationReachesEverySharedChain() public {
        _attest(alice, 30 days);
        _deliver(l1Teleporter, CCHAIN, _share(alice, aliceOnL1));

        vm.recordLogs();
        vm.prank(issuer);
        hub.revoke(alice, KYC);
        (TeleporterMessage memory revocation,) = _lastSent();
        _deliver(l1Teleporter, CCHAIN, revocation);
        assertFalse(gate.hasClaim(aliceOnL1, KYC));
        assertFalse(hub.hasValidClaim(alice, KYC));
    }

    function test_LateShareCannotUndoANewerRevocation() public {
        _attest(alice, 30 days);
        TeleporterMessage memory grant = _share(alice, aliceOnL1);
        vm.recordLogs();
        vm.prank(issuer);
        hub.revoke(alice, KYC);
        (TeleporterMessage memory revocation,) = _lastSent();

        _deliver(l1Teleporter, CCHAIN, revocation);
        _deliver(l1Teleporter, CCHAIN, grant);
        assertFalse(gate.hasClaim(aliceOnL1, KYC));
    }

    function test_MovingToANewAccountRevokesTheOldOne() public {
        _attest(alice, 30 days);
        _deliver(l1Teleporter, CCHAIN, _share(alice, aliceOnL1));

        address fresh = makeAddr("aliceFreshAccount");
        vm.recordLogs();
        vm.prank(alice);
        hub.share(KYC, L1, address(gate), fresh);
        TeleporterMessage[] memory sent = _allSent();
        assertEq(sent.length, 2);
        _deliver(l1Teleporter, CCHAIN, sent[0]);
        _deliver(l1Teleporter, CCHAIN, sent[1]);

        assertFalse(gate.hasClaim(aliceOnL1, KYC));
        assertTrue(gate.hasClaim(fresh, KYC));
        assertEq(hub.sharesOf(alice, KYC).length, 1);
    }

    function test_UnshareAndForgetEraseTheRecord() public {
        _attest(alice, 30 days);
        _deliver(l1Teleporter, CCHAIN, _share(alice, aliceOnL1));

        vm.prank(aliceOnL1);
        gate.forget(KYC);
        assertFalse(gate.hasClaim(aliceOnL1, KYC));

        _deliver(l1Teleporter, CCHAIN, _share(alice, aliceOnL1));
        assertTrue(gate.hasClaim(aliceOnL1, KYC));

        vm.recordLogs();
        vm.prank(alice);
        hub.unshare(KYC, L1, address(gate));
        (TeleporterMessage memory withdrawal,) = _lastSent();
        _deliver(l1Teleporter, CCHAIN, withdrawal);
        assertFalse(gate.hasClaim(aliceOnL1, KYC));
        assertEq(hub.sharesOf(alice, KYC).length, 0);
    }

    function test_CompliantTokenMovesOnlyBetweenVerifiedAccounts() public {
        CompliantToken token = new CompliantToken("Fund Share", "FUND", gate, KYC, owner);
        address bobOnL1 = makeAddr("bobOnL1");
        _attest(alice, 30 days);
        _attest(bob, 1 days);
        _deliver(l1Teleporter, CCHAIN, _share(alice, aliceOnL1));
        _deliver(l1Teleporter, CCHAIN, _share(bob, bobOnL1));

        vm.prank(owner);
        token.mint(aliceOnL1, 100e18);
        vm.prank(aliceOnL1);
        token.transfer(bobOnL1, 10e18);
        assertEq(token.balanceOf(bobOnL1), 10e18);

        address stranger = makeAddr("stranger");
        vm.expectRevert(abi.encodeWithSelector(CompliantToken.ClaimRequired.selector, stranger, KYC));
        vm.prank(aliceOnL1);
        token.transfer(stranger, 1e18);

        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(abi.encodeWithSelector(CompliantToken.ClaimRequired.selector, bobOnL1, KYC));
        vm.prank(aliceOnL1);
        token.transfer(bobOnL1, 1e18);
    }

    function test_RevertWhen_RulesAreBroken() public {
        vm.expectRevert(abi.encodeWithSelector(IdentityHub.NotIssuer.selector, bob));
        vm.prank(bob);
        hub.attest(alice, KYC, uint64(block.timestamp + 1 days), bytes32(0));

        vm.expectRevert(abi.encodeWithSelector(IdentityHub.NoValidClaim.selector, alice, KYC));
        vm.prank(alice);
        hub.share(KYC, L1, address(gate), aliceOnL1);

        _attest(alice, 30 days);
        address unknownGate = makeAddr("unknownGate");
        vm.expectRevert(abi.encodeWithSelector(IdentityHub.UntrustedGate.selector, L1, unknownGate));
        vm.prank(alice);
        hub.share(KYC, L1, unknownGate, aliceOnL1);

        TeleporterMessage memory message = _share(alice, aliceOnL1);
        vm.expectRevert(abi.encodeWithSelector(IdentityGate.UnauthorizedMessenger.selector, bob));
        vm.prank(bob);
        gate.receiveTeleporterMessage(CCHAIN, address(hub), message.message);

        vm.expectRevert(abi.encodeWithSelector(IdentityGate.UntrustedHub.selector, CCHAIN, bob));
        vm.prank(address(l1Teleporter));
        gate.receiveTeleporterMessage(CCHAIN, bob, message.message);
    }
}
