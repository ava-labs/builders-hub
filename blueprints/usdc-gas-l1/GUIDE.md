# USDC as Gas on Your L1

Arc runs on USDC for gas. On Avalanche, any L1 can do the same with ICTT: USDC is locked on the C-Chain, and the L1 mints its own native coin 1:1 through the Native Minter precompile. Users pay fees in a stablecoin, and the chain stays sovereign.

## Prerequisites on the L1

Launch with `l1-quickstart` using `precompiles.nativeMinter`, `precompiles.interoperability` and `enableManagedRelayer`. That gives you:

- `contractNativeMinterConfig` in genesis, with the owner as admin. Without it the NativeTokenRemote constructor reverts.
- A Teleporter registry on the L1, and a relayer to Fuji C-Chain.
- Some native coins in the genesis allocation, so the deployer can pay gas for the first deployments.

## What gets deployed

1. `ERC20TokenHome` on Fuji C-Chain for USDC, with 6 decimals from the registry.
2. `NativeTokenRemote(settings, "USDC", initialReserveImbalance, burnedFeesReportingRewardPercentage)` on the L1.
3. `setEnabled(remote)` on the Native Minter (`$reg.precompiles.nativeMinter`), signed by the L1's minter admin.
4. `registerWithHome`, then a wait for delivery.
5. A read of `getRemoteTokenTransferrerSettings(...).collateralNeeded`, and if it is non-zero, approve and `addCollateral`. These steps carry `skipIf`, because `addCollateral` reverts when nothing is needed.
6. A test transfer of 0.5 USDC, which arrives as 0.5 native coins.

## The reserve imbalance, honestly

Native coins minted at genesis are not backed by USDC. `initialReserveImbalance` tells the bridge how many exist, and the home requires that much USDC collateral, scaled to 6 decimals, before any transfer.

- **Full backing (production)**: set it to the genesis supply in 18-decimal base units and deposit the same value in USDC. Keep the genesis allocation small, just enough for deployment gas, so the collateral is affordable.
- **Testnet default (`1`)**: the smallest valid value, since the constructor rejects 0. Genesis coins are treated as unbacked. Holders of unbacked coins can bridge out only USDC that others bridged in, so say this plainly to the builder.

The Circle faucet gives 1 USDC per request, which is why the test amount defaults to 0.5 USDC.

## Burned fees

Gas fees on the L1 are burned, which shrinks the native supply while the USDC stays locked. `reportBurnedTxFees(requiredGasLimit)` sends the burned amount back to the home, paying `burnedFeesReportingRewardPercentage` of it to the reporter. Run it periodically, from a keeper or the owner.

## Adapting it

- **Another stablecoin or token**: swap the home token for any ERC-20 in the registry and read its decimals from there.
- **Fee rebates**: set the reward percentage above 0 so third parties are paid to report burned fees.
- **Mainnet**: every step becomes user-signed. Get the collateral math reviewed before launch.

## Pitfalls

- `setEnabled` must come from a Native Minter admin or manager. If the builder's wallet is not one, the step fails. Check with `readAllowList(builder)` first.
- Users need a little native gas on the L1 before their first transaction. The top-up transfer itself runs on the C-Chain, so new users can get started without it.
