// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev The part of Chainlink's AggregatorV3Interface the tracker reads.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

/// @title PriceTracker
/// @notice Reads Chainlink Data Feeds by pair name, such as "AVAX/USD", and refuses stale or non-positive answers.
contract PriceTracker is Ownable {
    struct Feed {
        AggregatorV3Interface aggregator;
        /// @dev Seconds after which a round counts as stale. Match it to the feed's heartbeat.
        uint32 maxAge;
    }

    struct Price {
        int256 answer;
        uint8 decimals;
        uint256 updatedAt;
        uint80 roundId;
    }

    mapping(bytes32 => Feed) private _feeds;
    string[] private _pairs;

    event FeedSet(string pair, address indexed aggregator, uint32 maxAge);

    error InvalidFeed();
    error UnknownPair(string pair);
    error InvalidPrice(string pair, int256 answer);
    error StalePrice(string pair, uint256 updatedAt, uint32 maxAge);

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Adds a pair, or repoints an existing one to a new aggregator.
    function setFeed(string calldata pair, address aggregator, uint32 maxAge) external onlyOwner {
        if (aggregator == address(0) || maxAge == 0 || bytes(pair).length == 0) revert InvalidFeed();
        bytes32 key = keccak256(bytes(pair));
        if (address(_feeds[key].aggregator) == address(0)) _pairs.push(pair);
        _feeds[key] = Feed(AggregatorV3Interface(aggregator), maxAge);
        emit FeedSet(pair, aggregator, maxAge);
    }

    function latestPrice(string calldata pair) public view returns (Price memory price) {
        Feed memory feed = _feeds[keccak256(bytes(pair))];
        if (address(feed.aggregator) == address(0)) revert UnknownPair(pair);

        (uint80 roundId, int256 answer,, uint256 updatedAt,) = feed.aggregator.latestRoundData();
        if (answer <= 0) revert InvalidPrice(pair, answer);
        if (updatedAt == 0 || block.timestamp - updatedAt > feed.maxAge) revert StalePrice(pair, updatedAt, feed.maxAge);

        price = Price({answer: answer, decimals: feed.aggregator.decimals(), updatedAt: updatedAt, roundId: roundId});
    }

    function latestPrices(string[] calldata pairs) external view returns (Price[] memory prices) {
        prices = new Price[](pairs.length);
        for (uint256 i = 0; i < pairs.length; ++i) {
            prices[i] = latestPrice(pairs[i]);
        }
    }

    /// @notice Values `amount` of the pair's base asset, given with `amountDecimals`, in the quote currency.
    /// The result carries the feed's decimals: 8 for the USD feeds.
    function quote(string calldata pair, uint256 amount, uint8 amountDecimals)
        external
        view
        returns (uint256 value, uint8 valueDecimals)
    {
        Price memory price = latestPrice(pair);
        value = (amount * uint256(price.answer)) / (10 ** amountDecimals);
        valueDecimals = price.decimals;
    }

    function listPairs() external view returns (string[] memory) {
        return _pairs;
    }

    function feedOf(string calldata pair) external view returns (address aggregator, uint32 maxAge) {
        Feed memory feed = _feeds[keccak256(bytes(pair))];
        return (address(feed.aggregator), feed.maxAge);
    }
}
