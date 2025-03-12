//Original: https://github.com/ava-labs/icm-contracts/blob/8a8f78dcda0b0af60c6fb1762f7927351357d645/contracts/teleporter/ITeleporterReceiver.sol

// (c) 2022-2023, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: Ecosystem

pragma solidity 0.8.25;

/**
 * @dev Interface that cross-chain applications must implement to receive messages from Teleporter.
 *
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
interface ITeleporterReceiver {
    /**
     * @dev Called by TeleporterMessenger on the receiving chain.
     *
     * @param sourceBlockchainID is provided by the TeleporterMessenger contract.
     * @param originSenderAddress is provided by the TeleporterMessenger contract.
     * @param message is the TeleporterMessage payload set by the sender.
     */
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external;
}
