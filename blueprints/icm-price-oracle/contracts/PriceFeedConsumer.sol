// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ITeleporterMessenger, TeleporterFeeInfo, TeleporterMessageInput} from "@teleporter/ITeleporterMessenger.sol";
import {ITeleporterReceiver} from "@teleporter/ITeleporterReceiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PriceMessages} from "./PriceMessages.sol";

/// @title PriceFeedConsumer
/// @notice Keeps Chainlink prices on an Avalanche L1 that has no oracle of its own. Prices arrive over
/// ICM from one PriceFeedPublisher, fixed at deployment, either pushed or in answer to requestPrice().
contract PriceFeedConsumer is ITeleporterReceiver, Ownable {
    struct Price {
        int256 answer;
        uint256 updatedAt;
        uint80 roundId;
        uint64 receivedAt;
        uint8 decimals;
    }

    ITeleporterMessenger public immutable teleporterMessenger;
    bytes32 public immutable publisherBlockchainID;
    address public immutable publisher;

    /// @notice Gas the publisher gets to read the feed and send the answer back.
    uint256 public requestGasLimit;
    /// @notice Seconds after the source round's timestamp at which a stored price counts as stale.
    uint256 public maxAge;

    mapping(bytes32 pairHash => Price) private _prices;

    event PriceRequested(bytes32 indexed messageId, string pair);
    event PriceUpdated(string pair, int256 answer, uint256 updatedAt);
    event SettingsSet(uint256 requestGasLimit, uint256 maxAge);

    error ZeroAddress();
    error InvalidSettings();
    error NoPrice(string pair);
    error StalePrice(string pair, uint256 updatedAt, uint256 maxAge);
    error UnauthorizedMessenger(address caller);
    error UntrustedPublisher(bytes32 blockchainID, address sender);
    error UnexpectedMessage(uint8 kind);

    constructor(
        ITeleporterMessenger teleporterMessenger_,
        bytes32 publisherBlockchainID_,
        address publisher_,
        uint256 requestGasLimit_,
        uint256 maxAge_,
        address owner_
    ) Ownable(owner_) {
        if (address(teleporterMessenger_) == address(0) || publisher_ == address(0)) revert ZeroAddress();
        if (publisherBlockchainID_ == bytes32(0) || requestGasLimit_ == 0 || maxAge_ == 0) revert InvalidSettings();
        teleporterMessenger = teleporterMessenger_;
        publisherBlockchainID = publisherBlockchainID_;
        publisher = publisher_;
        requestGasLimit = requestGasLimit_;
        maxAge = maxAge_;
    }

    function setSettings(uint256 requestGasLimit_, uint256 maxAge_) external onlyOwner {
        if (requestGasLimit_ == 0 || maxAge_ == 0) revert InvalidSettings();
        requestGasLimit = requestGasLimit_;
        maxAge = maxAge_;
        emit SettingsSet(requestGasLimit_, maxAge_);
    }

    /// @notice Asks the publisher for the latest `pair` price. The answer arrives as a PriceUpdated event.
    function requestPrice(string calldata pair) external returns (bytes32 messageId) {
        messageId = teleporterMessenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: publisherBlockchainID,
                destinationAddress: publisher,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: requestGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: PriceMessages.encodeRequest(pair)
            })
        );
        emit PriceRequested(messageId, pair);
    }

    /// @inheritdoc ITeleporterReceiver
    function receiveTeleporterMessage(bytes32 sourceBlockchainID, address originSenderAddress, bytes calldata message)
        external
        override
    {
        if (msg.sender != address(teleporterMessenger)) revert UnauthorizedMessenger(msg.sender);
        if (sourceBlockchainID != publisherBlockchainID || originSenderAddress != publisher) {
            revert UntrustedPublisher(sourceBlockchainID, originSenderAddress);
        }

        (uint8 kind, bytes memory body) = PriceMessages.decode(message);
        if (kind != PriceMessages.UPDATE) revert UnexpectedMessage(kind);
        PriceMessages.PriceUpdate memory update = abi.decode(body, (PriceMessages.PriceUpdate));

        // Deliveries can arrive out of order or be retried later; never replace a newer round with an older one.
        bytes32 key = keccak256(bytes(update.pair));
        if (update.updatedAt <= _prices[key].updatedAt) return;

        _prices[key] = Price({
            answer: update.answer,
            updatedAt: update.updatedAt,
            roundId: update.roundId,
            receivedAt: uint64(block.timestamp),
            decimals: update.decimals
        });
        emit PriceUpdated(update.pair, update.answer, update.updatedAt);
    }

    /// @notice The stored price for `pair`. Reverts when none has arrived or when it is older than maxAge.
    function latestPrice(string calldata pair) external view returns (Price memory price) {
        price = _prices[keccak256(bytes(pair))];
        if (price.updatedAt == 0) revert NoPrice(pair);
        // Chain clocks can differ by a few seconds; a round stamped slightly ahead counts as fresh.
        uint256 age = block.timestamp > price.updatedAt ? block.timestamp - price.updatedAt : 0;
        if (age > maxAge) revert StalePrice(pair, price.updatedAt, maxAge);
    }
}
