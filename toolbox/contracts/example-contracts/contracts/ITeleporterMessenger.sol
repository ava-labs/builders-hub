//Original: https://github.com/ava-labs/icm-contracts/blob/8a8f78dcda0b0af60c6fb1762f7927351357d645/contracts/teleporter/ITeleporterMessenger.sol

// (c) 2023, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: Ecosystem

pragma solidity 0.8.25;

// A message receipt identifies the message that was delivered by its nonce,
// and the address that can redeem the reward for that message.
struct TeleporterMessageReceipt {
    uint256 receivedMessageNonce;
    address relayerRewardAddress;
}

// Represents all of the information required for submitting a Teleporter message
// to be sent to the given destination chain ID and address. Includes the fee
// information for the message, the amount of gas the relayer must provide to execute
// the message on the destination chain, the relayer accounts allowed to deliver the
// message, and the message data itself.
struct TeleporterMessageInput {
    bytes32 destinationBlockchainID;
    address destinationAddress;
    TeleporterFeeInfo feeInfo;
    uint256 requiredGasLimit;
    address[] allowedRelayerAddresses;
    bytes message;
}

// Represents a message sent or received by an implementation of {ITeleporterMessenger}.
struct TeleporterMessage {
    uint256 messageNonce;
    address originSenderAddress;
    bytes32 destinationBlockchainID;
    address destinationAddress;
    uint256 requiredGasLimit;
    address[] allowedRelayerAddresses;
    TeleporterMessageReceipt[] receipts;
    bytes message;
}

// Represents the fee information associated to a given Teleporter message.
// The contract address is the asset contract the fee will be paid in, and
// the amount is the amount of that specified asset.
struct TeleporterFeeInfo {
    address feeTokenAddress;
    uint256 amount;
}

/**
 * @dev Interface that describes functionalities for a cross-chain messenger implementing the Teleporter protcol.
 *
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
interface ITeleporterMessenger {
    /**
     * @notice Emitted when the blockchain ID of the contract instance is initialized using the Warp precompile.
     */
    event BlockchainIDInitialized(bytes32 indexed blockchainID);

    /**
     * @notice Emitted when sending a Teleporter message cross-chain.
     */
    event SendCrossChainMessage(
        bytes32 indexed messageID,
        bytes32 indexed destinationBlockchainID,
        TeleporterMessage message,
        TeleporterFeeInfo feeInfo
    );

    /**
     * @notice Emitted when an additional fee amount is added to a Teleporter message that had previously
     * been sent, but not yet delivered to the destination chain.
     */
    event AddFeeAmount(
        bytes32 indexed messageID,
        TeleporterFeeInfo updatedFeeInfo
    );

    /**
     * @notice Emitted when a Teleporter message is being delivered on the destination chain to an address,
     * but message execution fails. Failed messages can then be retried with `retryMessageExecution`
     */
    event MessageExecutionFailed(
        bytes32 indexed messageID,
        bytes32 indexed sourceBlockchainID,
        TeleporterMessage message
    );

    /**
     * @notice Emitted when a Teleporter message is successfully executed with the
     * specified destination address and message call data. This can occur either when
     * the message is initially received, or on a retry attempt.
     *
     * Each message received can be executed successfully at most once.
     */
    event MessageExecuted(
        bytes32 indexed messageID,
        bytes32 indexed sourceBlockchainID
    );

    /**
     * @notice Emitted when a TeleporterMessage is successfully received.
     */
    event ReceiveCrossChainMessage(
        bytes32 indexed messageID,
        bytes32 indexed sourceBlockchainID,
        address indexed deliverer,
        address rewardRedeemer,
        TeleporterMessage message
    );

    /**
     * @notice Emitted when a receipt is marked as received on the source chain that sent the
     * corresponding Teleporter message.
     */
    event ReceiptReceived(
        bytes32 indexed messageID,
        bytes32 indexed destinationBlockchainID,
        address indexed relayerRewardAddress,
        TeleporterFeeInfo feeInfo
    );

    /**
     * @notice Emitted when an account redeems accumulated relayer rewards.
     */
    event RelayerRewardsRedeemed(
        address indexed redeemer,
        address indexed asset,
        uint256 amount
    );

    /**
     * @notice Called by transactions to initiate the sending of a cross-chain message.
     * @return The message ID of the newly sent message.
     */
    function sendCrossChainMessage(
        TeleporterMessageInput calldata messageInput
    ) external returns (bytes32);

    /**
     * @notice Called by transactions to retry the sending of a cross-chain message.
     *
     * @dev Retriggers the sending of a message previously emitted by sendCrossChainMessage that has not yet been acknowledged
     * with a receipt from the destination chain. This may be necessary in the unlikely event that less than the required
     * threshold of stake weight successfully inserted the message in their messages DB at the time of the first submission.
     * The message is checked to have already been previously submitted by comparing its message hash against those kept in
     * state until a receipt is received for the message.
     */
    function retrySendCrossChainMessage(
        TeleporterMessage calldata message
    ) external;

    /**
     * @notice Adds the additional fee amount to the amount to be paid to the relayer that delivers
     * the given message ID to the destination chain.
     *
     * @dev The fee token address must be the same asset type as the fee asset specified in the original
     * call to sendCrossChainMessage. Reverts if the message doesn't exist or there is already
     * receipt of delivery of the message.
     */
    function addFeeAmount(
        bytes32 messageID,
        address feeTokenAddress,
        uint256 additionalFeeAmount
    ) external;

    /**
     * @notice Receives a cross-chain message, and marks the `relayerRewardAddress` for fee reward for a successful delivery.
     *
     * @dev The message specified by `messageIndex` must be provided at that index in the access list storage slots of the transaction,
     * and is verified in the precompile predicate.
     */
    function receiveCrossChainMessage(
        uint32 messageIndex,
        address relayerRewardAddress
    ) external;

    /**
     * @notice Retries the execution of a previously delivered message by verifying the payload matches
     * the hash of the payload originally delivered, and calling the destination address again.
     *
     * @dev Intended to be used if message excution failed on initial delivery of the Teleporter message.
     * For example, this may occur if the original required gas limit was not sufficient for the message
     * execution, or if the destination address did not contain a contract, but a compatible contract
     * was later deployed to that address. Messages are ensured to be successfully executed at most once.
     */
    function retryMessageExecution(
        bytes32 sourceBlockchainID,
        TeleporterMessage calldata message
    ) external;

    /**
     * @notice Sends the receipts for the given `messageIDs`.
     *
     * @dev Sends the specified message receipts in a new message (with an empty payload) back to the source chain.
     * This is intended for use in sending receipts that have not been sent in a timely manner by the standard
     * receipt delivery mechanism.
     * @return The message ID of the newly sent message.
     */
    function sendSpecifiedReceipts(
        bytes32 sourceBlockchainID,
        bytes32[] calldata messageIDs,
        TeleporterFeeInfo calldata feeInfo,
        address[] calldata allowedRelayerAddresses
    ) external returns (bytes32);

    /**
     * @notice Sends any fee amount rewards for the given fee asset out to the caller.
     */
    function redeemRelayerRewards(address feeTokenAddress) external;

    /**
     * @notice Gets the hash of a given message stored in the EVM state, if the message exists.
     * @return The message hash
     */
    function getMessageHash(bytes32 messageID) external view returns (bytes32);

    /**
     * @notice Checks whether or not the given message has been received by this chain.
     * @return Boolean representing if the given message has been received.
     */
    function messageReceived(bytes32 messageID) external view returns (bool);

    /**
     * @notice Returns the address the relayer reward should be sent to on the source chain
     * for a given message, assuming that the message has already been delivered.
     * @return The relayer reward address for the given message.
     */
    function getRelayerRewardAddress(
        bytes32 messageID
    ) external view returns (address);

    /**
     * @notice Gets the current reward amount of a given fee asset that is redeemable by the given relayer.
     * @return The amount of the fee asset redeemable by the specified relayer.
     */
    function checkRelayerRewardAmount(
        address relayer,
        address feeTokenAddress
    ) external view returns (uint256);

    /**
     * @notice Gets the fee token address and amount for a given sent message.
     * @return The fee token address and fee amount for a the given sent message ID.
     * If the message ID is not found, zero address and amount values are returned.
     */
    function getFeeInfo(
        bytes32 messageID
    ) external view returns (address, uint256);

    /**
     * @notice Gets the message ID that would currently be used for the next message sent from the contract
     * instance to the given destination blockchain.
     *
     * @dev This message ID may never be used in the event that the next call to sendCrossChainMessage in a
     * transaction uses a different destination blockchain. The current value as returned by this function will
     * change with each successful call to sendCrossChainMessage.
     * @return The specified message ID.
     */
    function getNextMessageID(
        bytes32 destinationBlockchainID
    ) external view returns (bytes32);

    /**
     * @notice Gets the number of receipts that are waiting to be sent to the given source chain ID.
     * @return Size of the given queue.
     */
    function getReceiptQueueSize(
        bytes32 sourceBlockchainID
    ) external view returns (uint256);

    /**
     * @notice Gets the receipt at the given index in the queue for the given source chain ID.
     * @return The receipt requested.
     */
    function getReceiptAtIndex(
        bytes32 sourceBlockchainID,
        uint256 index
    ) external view returns (TeleporterMessageReceipt memory);
}
