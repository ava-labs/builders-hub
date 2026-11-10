# CCIP Messenger

Arbitrary messages between the Avalanche C-Chain and other EVM chains over Chainlink CCIP 2.0. It is the counterpart of `icm-messenger`, which stays within Avalanche: reach for ICM between Avalanche chains and CCIP when the other side is Ethereum, Base, Arbitrum or OP.

## What gets deployed

1. `CCIPMessenger(router, deployer)` on Fuji C-Chain, and another on the destination testnet. Each router comes from the registry for its chain.
   - The destination is a user-signed network, so the builder's wallet deploys and configures it and needs testnet ETH there.
2. Four allowlist calls, making the pair two-way:
   - the C-Chain side may send to the destination;
   - the destination accepts the C-Chain messenger as a sender;
   - the destination may reply to the C-Chain;
   - the C-Chain side accepts the destination messenger.
3. `transferOwnership` to the builder on both sides.
4. A smoke test:
   - encode `extraArgs` with the receiver's gas limit;
   - quote `getFee`;
   - call `sendMessage` with the fee as value;
   - wait for delivery and check `receivedCount`.

## Security model

- `ccipReceive` is callable only by the router (`onlyRouter` in `CCIPReceiver`).
- `_ccipReceive` rejects any `(sourceChainSelector, sender)` pair that isn't allowlisted.
- `getCCVsAndFinalityConfig`, new in CCIP 2.0, applies the same allowlist, so the OffRamp refuses unknown senders before executing. It also returns the finality the receiver accepts per source chain. The default, `bytes4(0)`, requires full finality.

## Gas and extraArgs

Unlike token-only transfers, data messages run receiver code, so `extraArgs` must carry a gas limit. Storing a maximum 280-byte message the first time costs about 150,000 gas, and the default of 300,000 leaves headroom. Encode `extraArgs` off-chain with `@chainlink/ccip-sdk` for the specific lane, then pass it in. Too low a gas limit makes execution fail on the destination; the message can then be executed manually from the CCIP explorer with more gas.

## Adapting it

- **Typed commands**: encode `(uint8 kind, bytes body)` and dispatch on `kind`, as the ICM oracle does.
- **Tokens and data together**: put USDC in `tokenAmounts` and a payload in `data`. The receiver sees `destTokenAmounts` in `_ccipReceive`.
- **Faster than finality**: have the owner call `setAllowedFinalityConfig(sourceSelector, config)` only if the app tolerates reorg risk. Keep the sender allowlist either way.

## Pitfalls

- A failed `_ccipReceive` does not revert the send. The message sits on the destination until someone executes it manually. Keep receivers simple and bounded.
- Replies need both allowlists in the reverse direction, which this blueprint sets up.
