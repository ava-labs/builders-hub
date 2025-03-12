//Original: https://github.com/ava-labs/avalanche-starter-kit/blob/21e0481966167736d616397ff09b52b0b2cc2398/contracts/interchain-messaging/send-receive/senderOnCChain.sol
//(slight modifications)

// (c) 2023, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: Ecosystem

pragma solidity ^0.8.18;

import "./ITeleporterMessenger.sol";

// Deployed on Fucji C-Chain testnet at 0x2419133a23EA13EAF3dC3ee2382F083067107386
// https://subnets-test.avax.network/c-chain/address/0x2419133a23EA13EAF3dC3ee2382F083067107386
contract SenderOnCChain {
    ITeleporterMessenger public immutable messenger =
        ITeleporterMessenger(0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf);

    /**
     * @dev Sends a message to another chain.
     */
    function sendMessage(
        address destinationAddress,
        string calldata message,
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
}
