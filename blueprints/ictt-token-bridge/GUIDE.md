# ICTT Token Bridge

Interchain Token Transfer (ICTT) bridges an ERC-20 between Avalanche chains without a third-party bridge. `ERC20TokenHome` locks the original on its home chain, and `ERC20TokenRemote` is a 1:1 ERC-20 on the remote chain. ICM carries every registration and transfer.

Both contracts are Ava Labs' audited ICTT contracts, deployed from the precompiled artifacts in `contracts/icm-contracts/compiled`. Never write your own bridge contracts for this.

## What gets deployed

1. The relayer check.
2. `ERC20TokenHome(registry, manager, minTeleporterVersion, token, tokenDecimals)` on the home chain.
3. `ERC20TokenRemote(settings, name, symbol, decimals)` on the remote chain. The settings point at the home chain's blockchain ID (hex) and the TokenHome address.
4. `registerWithHome` on the remote. This sends an ICM message, and the home accepts transfers to that remote only after it arrives.
5. Approve, then `send` a test amount from home to remote, and wait for delivery.

## Parameters that matter

- **`tokenDecimals`** must equal the home token's `decimals()`. Read it on-chain rather than assuming 18.
- **`remoteDecimals`** can differ, and ICTT scales amounts between them, but keep them equal unless there is a reason not to. With different decimals, the check on the received amount no longer compares like with like.
- **`teleporterManager`** can pause a compromised Teleporter version and raise the minimum version. Give it to the builder or a multisig, never the platform deployer.
- **`requiredGasLimit`**: 250,000 is the console's default for an ERC-20 remote mint. `sendAndCall`, which triggers a contract on arrival, needs a higher limit, covering the recipient's work.

## Going back

From the remote, first `approve(tokenRemote, amount)` on the TokenRemote itself. The remote is the bridged token, and it pulls the amount from the caller before burning it. Then call `send` on `ERC20TokenRemote` with the home's blockchain ID and the TokenHome address. The test in `test/TokenBridge.t.sol` runs this round trip against the real ICTT bytecode.

## Adapting it

- **The token doesn't exist yet**: run `erc20-token` on the home chain first and pass its address as `token`.
- **Several L1s**: deploy one TokenRemote per L1, all pointing at the same TokenHome, and register each.
- **The token should be the L1's gas token**: use `usdc-gas-l1`. It follows the same pattern with `NativeTokenRemote`.
- **Contract calls on arrival**: use `sendAndCall`, so the recipient contract is called with the tokens and a payload, for example to deposit into a vault on the L1.

## Pitfalls

- `send` before registration has been delivered reverts on the home. Wait for the registration message.
- Blockchain IDs are 32-byte hex, from `blockchainIdHex`.
