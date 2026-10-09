# ICM Messenger

The canonical Interchain Messaging (ICM) pattern: a contract on each chain that sends through the local TeleporterMessenger and accepts messages only from its trusted counterpart. Copy it whenever one Avalanche chain has to act on something that happened on another.

## How a message travels

1. `sendMessage` on the source calls `TeleporterMessenger.sendCrossChainMessage` with the destination blockchain ID, destination address, a relayer fee (optional), the gas the receiver may use, and the payload `abi.encode(author, text)`.
2. The source chain's validators sign a Warp message. A relayer collects the signatures and submits them to the destination's TeleporterMessenger.
3. The destination messenger calls `receiveTeleporterMessage(sourceBlockchainID, originSenderAddress, payload)` with exactly `requiredGasLimit` gas.

If that last call reverts or runs out of gas, the message is marked failed and anyone can retry it with `retryMessageExecution`. The messenger itself never reverts on your behalf.

## What gets deployed

1. The relayer check (`icm.ensure-relayer`). An L1 from `l1-quickstart` with `enableManagedRelayer` already has one to Fuji C-Chain, unless that relayer never came up; Studio says so at this step.
2. `ICMMessenger(teleporterMessenger, deployer)` on each chain. The messenger address comes from the registry and is the same on every chain.
3. `setTrustedRemote` on both sides, each pointing at the other's blockchain ID (hex) and address.
4. `transferOwnership` to the builder on both sides.
5. Optionally, a first message, then a wait until `messageReceived(messageId)` is true on the destination.

## Security rules to keep

- Check `msg.sender == teleporterMessenger` first. Anyone can call `receiveTeleporterMessage` directly.
- Check the `(sourceBlockchainID, originSenderAddress)` pair. The author inside the payload is only as trustworthy as the contract that wrote it.
- Keep the messenger address immutable. An owner who can swap it can forge any message.

## Gas

`DEFAULT_GAS_LIMIT` is 300,000: about twice the cost of a first delivery of a maximum 280-byte message, measured against the real TeleporterMessenger. If the receiver does more work, such as minting or writing several slots, measure it and raise the limit. On Fuji the managed relayer delivers without fees. On a paid relayer, pass an ERC-20 fee: the caller approves this contract, and the contract approves the messenger.

## Adapting it

- **Typed actions instead of text**: encode `(uint8 kind, bytes body)`, as `icm-price-oracle` does, and switch on `kind` in the receiver.
- **Request and response**: have the receiver send a reply through its own messenger. Budget the reply's send cost into the request's gas limit.
- **Upgradable Teleporter versions**: for production, inherit `TeleporterRegistryOwnableApp` from icm-contracts, so the app can move to a new Teleporter version through the registry.

## Pitfalls

- Blockchain IDs must be 32-byte hex (`blockchainIdHex`), not the CB58 strings the console shows.
- Messages are not ordered across senders. Design receivers so a late or retried delivery does no harm.
