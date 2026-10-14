// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/// @title PriceMessages
/// @notice Wire format shared by PriceFeedPublisher and PriceFeedConsumer: a kind byte and an ABI-encoded body.
library PriceMessages {
    uint8 internal constant REQUEST = 1;
    uint8 internal constant UPDATE = 2;

    struct PriceUpdate {
        string pair;
        int256 answer;
        uint8 decimals;
        uint256 updatedAt;
        uint80 roundId;
    }

    function encodeRequest(string memory pair) internal pure returns (bytes memory) {
        return abi.encode(REQUEST, abi.encode(pair));
    }

    function encodeUpdate(PriceUpdate memory update) internal pure returns (bytes memory) {
        return abi.encode(UPDATE, abi.encode(update));
    }

    function decode(bytes memory message) internal pure returns (uint8 kind, bytes memory body) {
        return abi.decode(message, (uint8, bytes));
    }
}
