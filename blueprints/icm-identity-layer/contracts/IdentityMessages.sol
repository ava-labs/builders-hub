// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title IdentityMessages
/// @notice Wire format between IdentityHub and IdentityGate. A message carries only what the destination
/// needs: which local account, which claim, until when, and a hub-wide sequence number for ordering.
library IdentityMessages {
    uint8 internal constant SHARE = 1;
    uint8 internal constant REVOKE = 2;

    function encode(uint8 kind, address account, bytes32 claimType, uint64 expiresAt, uint64 sequence)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(kind, account, claimType, expiresAt, sequence);
    }

    function decode(bytes memory message)
        internal
        pure
        returns (uint8 kind, address account, bytes32 claimType, uint64 expiresAt, uint64 sequence)
    {
        return abi.decode(message, (uint8, address, bytes32, uint64, uint64));
    }
}
