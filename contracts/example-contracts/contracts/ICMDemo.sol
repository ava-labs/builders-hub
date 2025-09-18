// Original sources:
// https://github.com/ava-labs/avalanche-starter-kit/blob/21e0481966167736d616397ff09b52b0b2cc2398/contracts/interchain-messaging/send-receive/senderOnCChain.sol
// https://github.com/ava-labs/avalanche-starter-kit/blob/21e0481966167736d616397ff09b52b0b2cc2398/contracts/interchain-messaging/send-receive/receiverOnSubnet.sol

// (c) 2023, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: Ecosystem

pragma solidity ^0.8.28;

import "./ITeleporterMessenger.sol";
import "./ITeleporterReceiver.sol";

contract ICMDemo is ITeleporterReceiver {
    ITeleporterMessenger public immutable messenger =
        ITeleporterMessenger(0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf);

    uint256 public lastMessage;

    /**
     * @dev Sends a message to another chain.
     */
    function sendMessage(
        address destinationAddress,
        uint256 message,
        bytes32 destinationBlockchainID
    ) external {
        messenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: destinationAddress,
                feeInfo: TeleporterFeeInfo({
                    feeTokenAddress: address(0),
                    amount: 0
                }),
                requiredGasLimit: 100000,
                allowedRelayerAddresses: new address[](0),
                message: abi.encode(message)
            })
        );
    }

    function receiveTeleporterMessage(
        bytes32,
        address,
        bytes calldata message
    ) external override {
        // Only the Teleporter receiver can deliver a message.
        require(
            msg.sender == address(messenger),
            "SenderReceiver: unauthorized TeleporterMessenger"
        );

        // Store the message.
        lastMessage = abi.decode(message, (uint256));
    }
}
