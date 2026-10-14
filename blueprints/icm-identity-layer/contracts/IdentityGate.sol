// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeleporterMessenger} from "@teleporter/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "@teleporter/ITeleporterReceiver.sol";
import {IdentityMessages} from "./IdentityMessages.sol";

/// @title IdentityGate
/// @notice An L1's view of the identity layer. It learns claims only from one IdentityHub, fixed at
/// deployment, and only what the subject chose to share: which local account holds which claim, until
/// when. Apps on the L1 ask hasClaim(account, claimType) and never see personal data or the subject's
/// C-Chain address.
contract IdentityGate is ITeleporterReceiver {
    struct Claim {
        uint64 expiresAt;
        /// @dev Hub sequence of the last message applied; older deliveries are ignored.
        uint64 sequence;
    }

    ITeleporterMessenger public immutable teleporterMessenger;
    bytes32 public immutable hubBlockchainID;
    address public immutable hub;

    mapping(address account => mapping(bytes32 claimType => Claim)) private _claims;

    event ClaimGranted(address indexed account, bytes32 indexed claimType, uint64 expiresAt);
    event ClaimRevoked(address indexed account, bytes32 indexed claimType);
    event ClaimForgotten(address indexed account, bytes32 indexed claimType);
    event StaleMessageIgnored(address indexed account, bytes32 indexed claimType, uint64 sequence);

    error ZeroAddress();
    error UnauthorizedMessenger(address caller);
    error UntrustedHub(bytes32 blockchainID, address sender);
    error UnexpectedMessage(uint8 kind);
    error MissingClaim(address account, bytes32 claimType);

    constructor(ITeleporterMessenger teleporterMessenger_, bytes32 hubBlockchainID_, address hub_) {
        if (address(teleporterMessenger_) == address(0) || hub_ == address(0)) revert ZeroAddress();
        teleporterMessenger = teleporterMessenger_;
        hubBlockchainID = hubBlockchainID_;
        hub = hub_;
    }

    /// @inheritdoc ITeleporterReceiver
    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
        override
    {
        if (msg.sender != address(teleporterMessenger)) revert UnauthorizedMessenger(msg.sender);
        if (sourceBlockchainID != hubBlockchainID || originSenderAddress != hub) {
            revert UntrustedHub(sourceBlockchainID, originSenderAddress);
        }

        (uint8 kind, address account, bytes32 claimType, uint64 expiresAt, uint64 sequence) =
            IdentityMessages.decode(message);
        Claim storage claim = _claims[account][claimType];
        // ICM does not order deliveries; a late share must never undo a newer revocation.
        if (sequence <= claim.sequence) {
            emit StaleMessageIgnored(account, claimType, sequence);
            return;
        }
        claim.sequence = sequence;

        if (kind == IdentityMessages.SHARE) {
            claim.expiresAt = expiresAt;
            emit ClaimGranted(account, claimType, expiresAt);
        } else if (kind == IdentityMessages.REVOKE) {
            claim.expiresAt = 0;
            emit ClaimRevoked(account, claimType);
        } else {
            revert UnexpectedMessage(kind);
        }
    }

    function hasClaim(address account, bytes32 claimType) public view returns (bool) {
        return _claims[account][claimType].expiresAt > block.timestamp;
    }

    function claimExpiry(address account, bytes32 claimType) external view returns (uint64) {
        return _claims[account][claimType].expiresAt;
    }

    function requireClaim(address account, bytes32 claimType) external view {
        if (!hasClaim(account, claimType)) revert MissingClaim(account, claimType);
    }

    /// @notice Lets an account erase its own record on this chain. Sharing again from the hub restores it.
    function forget(bytes32 claimType) external {
        _claims[msg.sender][claimType].expiresAt = 0;
        emit ClaimForgotten(msg.sender, claimType);
    }
}
