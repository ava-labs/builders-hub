// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeleporterMessenger, TeleporterFeeInfo, TeleporterMessageInput} from "@teleporter/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "@teleporter/ITeleporterReceiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PriceMessages} from "./PriceMessages.sol";

/// @dev The part of Chainlink's AggregatorV3Interface the publisher reads.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title PriceFeedPublisher
/// @notice Lives on a chain with Chainlink Data Feeds (the C-Chain) and sends prices to trusted
/// PriceFeedConsumer contracts on other Avalanche chains over ICM. Consumers either receive pushed
/// updates, which anyone can trigger with publish(), or ask with a request that is answered on arrival.
contract PriceFeedPublisher is ITeleporterReceiver, Ownable {
    ITeleporterMessenger public immutable teleporterMessenger;
    /// @notice Gas each consumer gets to store an update on delivery.
    uint256 public updateGasLimit;

    mapping(bytes32 pairHash => AggregatorV3Interface) private _feeds;
    mapping(bytes32 blockchainID => mapping(address consumer => bool)) public trustedConsumer;

    event FeedSet(string pair, address indexed aggregator);
    event TrustedConsumerSet(bytes32 indexed blockchainID, address indexed consumer, bool trusted);
    event UpdateGasLimitSet(uint256 gasLimit);
    event PricePublished(
        bytes32 indexed messageId,
        bytes32 indexed destinationBlockchainID,
        address indexed consumer,
        string pair,
        int256 answer,
        uint256 updatedAt
    );

    error ZeroAddress();
    error InvalidGasLimit();
    error UnknownPair(string pair);
    error InvalidPrice(string pair, int256 answer);
    error UntrustedConsumer(bytes32 blockchainID, address consumer);
    error UnauthorizedMessenger(address caller);
    error UnexpectedMessage(uint8 kind);

    constructor(ITeleporterMessenger teleporterMessenger_, uint256 updateGasLimit_, address owner_) Ownable(owner_) {
        if (address(teleporterMessenger_) == address(0)) revert ZeroAddress();
        if (updateGasLimit_ == 0) revert InvalidGasLimit();
        teleporterMessenger = teleporterMessenger_;
        updateGasLimit = updateGasLimit_;
    }

    function setFeed(string calldata pair, address aggregator) external onlyOwner {
        if (aggregator == address(0)) revert ZeroAddress();
        _feeds[keccak256(bytes(pair))] = AggregatorV3Interface(aggregator);
        emit FeedSet(pair, aggregator);
    }

    function setTrustedConsumer(bytes32 blockchainID, address consumer, bool trusted) external onlyOwner {
        if (consumer == address(0)) revert ZeroAddress();
        trustedConsumer[blockchainID][consumer] = trusted;
        emit TrustedConsumerSet(blockchainID, consumer, trusted);
    }

    function setUpdateGasLimit(uint256 gasLimit) external onlyOwner {
        if (gasLimit == 0) revert InvalidGasLimit();
        updateGasLimit = gasLimit;
        emit UpdateGasLimitSet(gasLimit);
    }

    /// @notice Pushes the latest `pair` price to a trusted consumer. Anyone may call it, paying the gas;
    /// a keeper calling it on a schedule keeps the consumer fresh without requests.
    function publish(string calldata pair, bytes32 destinationBlockchainID, address consumer)
        external
        returns (bytes32 messageId)
    {
        if (!trustedConsumer[destinationBlockchainID][consumer]) revert UntrustedConsumer(destinationBlockchainID, consumer);
        return _publish(pair, destinationBlockchainID, consumer);
    }

    /// @notice Answers a trusted consumer's request with the latest price for the requested pair.
    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
        override
    {
        if (msg.sender != address(teleporterMessenger)) revert UnauthorizedMessenger(msg.sender);
        if (!trustedConsumer[sourceBlockchainID][originSenderAddress]) {
            revert UntrustedConsumer(sourceBlockchainID, originSenderAddress);
        }

        (uint8 kind, bytes memory body) = PriceMessages.decode(message);
        if (kind != PriceMessages.REQUEST) revert UnexpectedMessage(kind);
        _publish(abi.decode(body, (string)), sourceBlockchainID, originSenderAddress);
    }

    function feedOf(string calldata pair) external view returns (address) {
        return address(_feeds[keccak256(bytes(pair))]);
    }

    function _publish(string memory pair, bytes32 destinationBlockchainID, address consumer)
        private
        returns (bytes32 messageId)
    {
        AggregatorV3Interface feed = _feeds[keccak256(bytes(pair))];
        if (address(feed) == address(0)) revert UnknownPair(pair);

        (uint80 roundId, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        if (answer <= 0 || updatedAt == 0) revert InvalidPrice(pair, answer);

        PriceMessages.PriceUpdate memory update = PriceMessages.PriceUpdate({
            pair: pair,
            answer: answer,
            decimals: feed.decimals(),
            updatedAt: updatedAt,
            roundId: roundId
        });
        messageId = teleporterMessenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: consumer,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: updateGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: PriceMessages.encodeUpdate(update)
            })
        );
        emit PricePublished(messageId, destinationBlockchainID, consumer, pair, answer, updatedAt);
    }
}
