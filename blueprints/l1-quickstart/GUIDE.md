# Launch an L1

Launches a Subnet-EVM L1 on Fuji with one API call to the Builder Hub's Quick L1 service. It runs server-side, so the builder only waits. It is the starting point for every blueprint that uses the `l1` network.

## What the job does

The orchestrator walks `DEPLOYMENT_STEPS` in `lib/quick-l1/types.ts`:

1. Creates the subnet.
2. Deploys the Validator Manager on the C-Chain.
3. Provisions a managed validator node.
4. Creates the chain from a genesis carrying the chosen precompiles.
5. Converts the subnet to an L1 and initializes the validator set.

With `managedRelayer` on, it also reserves and starts an ICM relayer, deploys a TeleporterRegistry and a TokenRemote on the L1, and bridges demo MockUSDC from the C-Chain.

Each step records its transactions as evidence. The result carries `subnetId`, `blockchainId`, `evmChainId`, `rpcUrl`, `validatorManagerAddress`, `nodeId`, `interop` (registry, relayer and bridge addresses) and `explorer.url`.

## Binding the result for other blueprints

After `wait-launch`, bind the registry's `l1` entry at run time:

- `evmChainId` and `rpcUrl` straight from the result.
- `blockchainId`, and `blockchainIdHex` decoded from the CB58 id: 32 bytes, as Teleporter expects.
- `subnetId`.
- `teleporter.registry` from `interop.icmRegistryAddress`.
- `explorerUrl` from `explorer.url`.

`teleporter.messenger` is already the canonical address, because interoperability preinstalls it.

Then run `icm-messenger`, `ictt-token-bridge`, `icm-price-oracle` or `usdc-gas-l1` with `remote` or `destination` set to `l1`.

## Choosing options

| Goal | Options |
| --- | --- |
| Any ICM or ICTT blueprint | `interoperability: true` and `managedRelayer: true` |
| USDC as gas (`usdc-gas-l1`) | also `nativeMinter: true` |
| Anyone can validate | `validatorMode: "erc20-pos"`; the service deploys a staking token, reward calculator and staking manager on the C-Chain |
| Owner-run validators | `validatorMode: "poa"` (default) |

Native-token proof of stake and allowlist precompiles are not part of Quick L1. Use the console's advanced create flow for those.

## Pitfalls

- The API requires a signed-in session and is rate limited. Don't retry in a loop. Poll the status of the job you already started.
- If the job fails after the subnet was converted (a slow node that misses the RPC readiness wait, the ICM registry, the bridge, or the managed relayer), it reports failure with no result, but the L1 is already live. Studio rebuilds the result from the chain, binds it, and lists the steps that didn't finish. If the chain isn't reachable yet, the step stays failed and Continue checks again. When the relayer never started, the L1 is marked as having no relayer, and ICM blueprints on it need one from the console's [ICM Relayer](/console/testnet-infra/icm-relayer) page.
- Managed nodes and explorers expire after 3 days on testnet.
- Precompiles and interoperability are set at genesis. Adding them later needs a network upgrade (see the console's L1 upgrade tool).
