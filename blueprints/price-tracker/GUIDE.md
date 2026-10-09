# Price Tracker

Wraps Chainlink Data Feeds on the C-Chain behind readable pair names, and refuses answers that are stale or not positive. It is also the price source for `icm-price-oracle`, which carries these prices to an L1.

## What gets deployed

1. `PriceTracker(owner)`, with the platform deployer as the temporary owner.
2. `setFeed("AVAX/USD", feed, maxAge)`, taking the feed address from `$net.main.chainlink.feeds.AVAX/USD.address`.
3. `transferOwnership(builder)`.

Fuji also has `ETH/USD` and `BTC/USD` in the registry. Mainnet has only `AVAX/USD`. To add a pair, call `setFeed` with an address from the registry. If the registry lacks the feed, ask the builder to add it there, with its address from Chainlink's directory, instead of typing an address into a transaction.

## Contract surface

- `latestPrice(pair)` returns `(answer, decimals, updatedAt, roundId)`. It reverts with `UnknownPair`, `InvalidPrice` or `StalePrice`.
- `latestPrices(pairs)` batches reads for dashboards.
- `quote(pair, amount, amountDecimals)` returns the amount's value in the feed's quote currency, using the feed's decimals.
- `setFeed` adds a pair or repoints an existing one. Owner only.

## Staleness

`maxAge` must be longer than the feed's heartbeat, or reads revert between updates. Testnet feeds update rarely: when the registry was checked, Fuji's ETH/USD round was about 5 hours old. Use 24 hours on Fuji. On mainnet, look up each feed's heartbeat and add a small margin.

## Adapting it

- **Price a product in USD, charge in AVAX**: use `quote` in reverse. Compute `amountAvax = usdPrice * 1e18 / answer`, with the answer's 8 decimals accounted for, and add a slippage margin, because the price moves between quote and payment.
- **Cross-chain prices**: use `icm-price-oracle` rather than copying feeds by hand.

## Pitfalls

- Never cache a price in storage and treat it as current. Read the feed at the moment you use it.
- `answer` is an `int256`. The contract rejects values of zero or below; keep that check in any adaptation.
