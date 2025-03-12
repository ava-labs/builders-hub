//Original: https://github.com/ava-labs/avalanche-starter-kit/blob/21e0481966167736d616397ff09b52b0b2cc2398/contracts/interchain-messaging/send-receive/receiverOnSubnet.sol

// (c) 2023, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: Ecosystem

pragma solidity ^0.8.18;

import "./ITeleporterMessenger.sol";
import "./ITeleporterReceiver.sol";

contract ReceiverOnSubnet is ITeleporterReceiver {
    ITeleporterMessenger public immutable messenger =
        ITeleporterMessenger(0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf);

    string public lastMessage;

    function receiveTeleporterMessage(
        bytes32,
        address,
        bytes calldata message
    ) external {
        // Only the Teleporter receiver can deliver a message.
        require(
            msg.sender == address(messenger),
            "ReceiverOnSubnet: unauthorized TeleporterMessenger"
        );

        // Store the message.
        lastMessage = abi.decode(message, (string));
    }
}
