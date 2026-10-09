# ICM Price Oracle

Most Avalanche L1s have no Chainlink deployment. This blueprint carries C-Chain Chainlink prices to an L1 over ICM, with both push and pull. It is the reference for request-and-response patterns over ICM.

## Architecture

- **`PriceFeedPublisher`** on the C-Chain maps pair names to Chainlink aggregators and keeps a list of trusted consumers, keyed by `(blockchainID, address)`.
  - `publish(pair, l1, consumer)` pushes the latest round. Anyone may call it, so a keeper can run it.
  - When a trusted consumer's `REQUEST` arrives, the publisher answers with an `UPDATE`, sent from inside `receiveTeleporterMessage`.
- **`PriceFeedConsumer`** on the L1 fixes the publisher's chain and address at deployment.
  - It stores the newest round per pair and ignores anything older, so retries and reordering are harmless.
  - `requestPrice(pair)` asks for a fresh round.
- **`PriceMessages`** defines the wire format: `abi.encode(uint8 kind, bytes body)`.

## What gets deployed

1. The relayer check. An L1 from `l1-quickstart` with `enableManagedRelayer` already has one.
2. The publisher on the C-Chain, with `AVAX/USD` from `$net.home.chainlink.feeds.AVAX/USD.address`.
3. The consumer on the L1, pointing at the publisher's address and the C-Chain's blockchain ID in hex.
4. `setTrustedConsumer` on the publisher, then `transferOwnership` to the builder. The consumer is owned by the builder from its constructor.
5. A first push, and a wait until it is delivered.

## Gas budgets

Measured against the real TeleporterMessenger, with the Warp precompile's send cost included:

| Delivery | Measured | Default limit |
| --- | --- | --- |
| Consumer stores an update | about 75,000 | `updateGasLimit` 200,000 |
| Publisher answers a request, including its Teleporter send | about 155,000 | `requestGasLimit` 400,000 |

A request whose gas limit is too low fails on the C-Chain. Anyone can retry it later with `retryMessageExecution` at a higher gas limit, but the answer will be late. Keep the margins.

## Adapting it

- **More pairs**: call `setFeed` on the publisher with feed addresses from the registry. The consumer needs no change, because pairs are keyed by name.
- **Paid relayers**: the publisher sends answers with no fee. For a paid relayer, give the publisher a fee-token balance and set `feeInfo` in `_publish`, capped per message.
- **Several consumers**: trust each one on the publisher. Each consumer trusts only its one publisher.
- **Other data**: the same shape works for any C-Chain state an L1 needs, such as balances, governance results or NFT ownership. Change the message body and keep the trust checks.

## Pitfalls

- Pushes are only as fresh as the keeper. For critical reads, request first, then act on `PriceUpdated`.
- The consumer's `latestPrice` reverts when stale. Consumers that must never revert should read the raw price and decide for themselves.
