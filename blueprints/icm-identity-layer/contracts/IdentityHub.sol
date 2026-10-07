// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeleporterMessenger, TeleporterFeeInfo, TeleporterMessageInput} from "@teleporter/ITeleporterMessenger.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IdentityMessages} from "./IdentityMessages.sol";

/// @title IdentityHub
/// @notice Home of a cross-chain identity layer on the C-Chain. Allowlisted issuers attest yes/no claims
/// about a subject (KYC passed, accredited investor, over 18) without putting personal data on-chain:
/// an attestation is only a claim type, an expiry, and a commitment to the issuer's off-chain evidence.
/// A subject chooses which claims to share with which L1, and under which account on that L1. Shares
/// travel over ICM carrying (account, claim type, expiry) and nothing else; revocations follow every
/// share automatically, and a subject can withdraw consent per chain.
contract IdentityHub is Ownable2Step {
    struct Attestation {
        address issuer;
        uint64 expiresAt;
        bool revoked;
        /// @dev keccak256 of the issuer's off-chain record plus a salt; lets the issuer prove what it
        /// checked to an auditor without the record ever touching a chain.
        bytes32 evidenceCommitment;
    }

    struct Share {
        bytes32 blockchainID;
        address gate;
        address account;
    }

    uint256 public constant MAX_SHARES_PER_CLAIM = 8;

    ITeleporterMessenger public immutable teleporterMessenger;
    /// @notice Gas each IdentityGate gets to apply a message on delivery.
    uint256 public deliveryGasLimit;
    /// @notice Incremented for every message sent, so gates can drop deliveries that arrive out of order.
    uint64 public sequence;

    mapping(address issuer => bool) public isIssuer;
    mapping(bytes32 blockchainID => mapping(address gate => bool)) public trustedGate;
    mapping(address subject => mapping(bytes32 claimType => Attestation)) private _attestations;
    mapping(address subject => mapping(bytes32 claimType => Share[])) private _shares;

    event IssuerSet(address indexed issuer, bool allowed);
    event GateSet(bytes32 indexed blockchainID, address indexed gate, bool trusted);
    event DeliveryGasLimitSet(uint256 gasLimit);
    event Attested(address indexed subject, bytes32 indexed claimType, address indexed issuer, uint64 expiresAt);
    event Revoked(address indexed subject, bytes32 indexed claimType, address indexed by);
    event Shared(
        address indexed subject, bytes32 indexed claimType, bytes32 indexed blockchainID, address gate, bytes32 messageId
    );
    event Unshared(address indexed subject, bytes32 indexed claimType, bytes32 indexed blockchainID, address gate);

    error ZeroAddress();
    error InvalidGasLimit();
    error NotIssuer(address caller);
    error InvalidExpiry(uint64 expiresAt);
    error UnknownAttestation(address subject, bytes32 claimType);
    error NoValidClaim(address subject, bytes32 claimType);
    error UntrustedGate(bytes32 blockchainID, address gate);
    error TooManyShares(bytes32 claimType);
    error NotShared(bytes32 claimType, bytes32 blockchainID, address gate);

    constructor(ITeleporterMessenger teleporterMessenger_, uint256 deliveryGasLimit_, address owner_) Ownable(owner_) {
        if (address(teleporterMessenger_) == address(0)) revert ZeroAddress();
        if (deliveryGasLimit_ == 0) revert InvalidGasLimit();
        teleporterMessenger = teleporterMessenger_;
        deliveryGasLimit = deliveryGasLimit_;
    }

    function setIssuer(address issuer, bool allowed) external onlyOwner {
        if (issuer == address(0)) revert ZeroAddress();
        isIssuer[issuer] = allowed;
        emit IssuerSet(issuer, allowed);
    }

    function setTrustedGate(bytes32 blockchainID, address gate, bool trusted) external onlyOwner {
        if (gate == address(0)) revert ZeroAddress();
        trustedGate[blockchainID][gate] = trusted;
        emit GateSet(blockchainID, gate, trusted);
    }

    function setDeliveryGasLimit(uint256 gasLimit) external onlyOwner {
        if (gasLimit == 0) revert InvalidGasLimit();
        deliveryGasLimit = gasLimit;
        emit DeliveryGasLimitSet(gasLimit);
    }

    /// @notice Records or renews a claim. Renewal does not reach chains the claim was shared with until the
    /// subject shares again, which sends the new expiry.
    function attest(address subject, bytes32 claimType, uint64 expiresAt, bytes32 evidenceCommitment) external {
        if (!isIssuer[msg.sender]) revert NotIssuer(msg.sender);
        if (subject == address(0)) revert ZeroAddress();
        if (expiresAt <= block.timestamp) revert InvalidExpiry(expiresAt);
        _attestations[subject][claimType] = Attestation({
            issuer: msg.sender,
            expiresAt: expiresAt,
            revoked: false,
            evidenceCommitment: evidenceCommitment
        });
        emit Attested(subject, claimType, msg.sender, expiresAt);
    }

    /// @notice The attesting issuer, or the owner, revokes a claim; every chain it was shared with is told.
    function revoke(address subject, bytes32 claimType) external {
        Attestation storage attestation = _attestations[subject][claimType];
        if (attestation.issuer == address(0)) revert UnknownAttestation(subject, claimType);
        if (msg.sender != attestation.issuer && msg.sender != owner()) revert NotIssuer(msg.sender);
        attestation.revoked = true;

        Share[] storage shares = _shares[subject][claimType];
        for (uint256 i = 0; i < shares.length; ++i) {
            _send(shares[i], IdentityMessages.REVOKE, claimType, 0);
        }
        emit Revoked(subject, claimType, msg.sender);
    }

    /// @notice Shares one of the caller's claims with a trusted gate on another chain, under `account`,
    /// the caller's address on that chain. Sharing again with the same gate refreshes the expiry, or
    /// moves the claim to a new account after revoking it on the old one.
    function share(bytes32 claimType, bytes32 blockchainID, address gate, address account)
        external
        returns (bytes32 messageId)
    {
        if (!trustedGate[blockchainID][gate]) revert UntrustedGate(blockchainID, gate);
        if (account == address(0)) revert ZeroAddress();
        Attestation storage attestation = _attestations[msg.sender][claimType];
        if (!_isValid(attestation)) revert NoValidClaim(msg.sender, claimType);

        Share[] storage shares = _shares[msg.sender][claimType];
        bool known;
        for (uint256 i = 0; i < shares.length; ++i) {
            Share storage existing = shares[i];
            if (existing.blockchainID == blockchainID && existing.gate == gate) {
                if (existing.account != account) {
                    _send(existing, IdentityMessages.REVOKE, claimType, 0);
                    existing.account = account;
                }
                known = true;
                break;
            }
        }
        if (!known) {
            if (shares.length == MAX_SHARES_PER_CLAIM) revert TooManyShares(claimType);
            shares.push(Share({blockchainID: blockchainID, gate: gate, account: account}));
        }

        messageId = _send(
            Share({blockchainID: blockchainID, gate: gate, account: account}),
            IdentityMessages.SHARE,
            claimType,
            attestation.expiresAt
        );
        emit Shared(msg.sender, claimType, blockchainID, gate, messageId);
    }

    /// @notice Withdraws consent for one chain; its gate deletes the record.
    function unshare(bytes32 claimType, bytes32 blockchainID, address gate) external returns (bytes32 messageId) {
        Share[] storage shares = _shares[msg.sender][claimType];
        for (uint256 i = 0; i < shares.length; ++i) {
            if (shares[i].blockchainID == blockchainID && shares[i].gate == gate) {
                messageId = _send(shares[i], IdentityMessages.REVOKE, claimType, 0);
                shares[i] = shares[shares.length - 1];
                shares.pop();
                emit Unshared(msg.sender, claimType, blockchainID, gate);
                return messageId;
            }
        }
        revert NotShared(claimType, blockchainID, gate);
    }

    function attestationOf(address subject, bytes32 claimType) external view returns (Attestation memory) {
        return _attestations[subject][claimType];
    }

    function hasValidClaim(address subject, bytes32 claimType) external view returns (bool) {
        return _isValid(_attestations[subject][claimType]);
    }

    function sharesOf(address subject, bytes32 claimType) external view returns (Share[] memory) {
        return _shares[subject][claimType];
    }

    /// @dev Removing an issuer invalidates its attestations for new shares; existing shares stay until
    /// they expire or are revoked.
    function _isValid(Attestation storage attestation) private view returns (bool) {
        return attestation.issuer != address(0) && !attestation.revoked && attestation.expiresAt > block.timestamp
            && isIssuer[attestation.issuer];
    }

    function _send(Share memory target, uint8 kind, bytes32 claimType, uint64 expiresAt) private returns (bytes32) {
        sequence += 1;
        return teleporterMessenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: target.blockchainID,
                destinationAddress: target.gate,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: deliveryGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: IdentityMessages.encode(kind, target.account, claimType, expiresAt, sequence)
            })
        );
    }
}
