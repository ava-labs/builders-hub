# Finish ICM on your L1

Deploys the Teleporter registry on an L1 whose Quick L1 launch stopped before that step, then points the builder to a relayer. It is the repair path for `l1-quickstart`, and it also works for any L1 the builder bound that has a TeleporterMessenger but no registry.

## When to use it

`l1-quickstart` keeps the L1 when a setup step after the chain conversion fails, for example when the node misses the RPC readiness wait. The chain is live, but the registry, the demo bridge and the managed relayer may not exist. Blueprints such as `icm-messenger` and `ictt-token-bridge` read `$net.l1.teleporter.registry`, so they cannot run until it does.

Use this blueprint when the bound L1 has a messenger and no registry. If the L1 already has a registry, do not run it: a second registry only adds a duplicate.

## What gets deployed

1. `TeleporterRegistry([{ version: 1, protocolAddress: teleporterMessenger }])` on the L1, signed by the builder's wallet. The messenger address comes from the bound L1, confirmed on-chain when it was bound.
2. Two checks: `latestVersion()` is 1, and `getAddressFromVersion(1)` is the messenger.
3. A relayer check (`icm.ensure-relayer`) for the L1 and the C-Chain. Studio cannot see relayers, so the builder confirms it by hand after adding both chains under the console's ICM Relayer page.

Once the registry deploys, Studio records it on the project's L1, so later ICM and ICTT blueprints resolve it, and copies it into the console's L1 list for the ICM and ICTT tools.

## Pitfalls

- The signer needs native gas on the L1. The owner set at launch receives the genesis allocation, so sign with that wallet.
- A managed relayer covers the chains listed on it, and each relayer address needs gas on those chains. Adding the L1 to a relayer does not fund it.
- The demo MockUSDC bridge that a full Quick L1 launch sets up is not part of this blueprint. Use `ictt-token-bridge` for a real token.
