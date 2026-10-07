# CCIP USDC Bridge

Moves USDC from the Avalanche C-Chain to other EVM chains over Chainlink CCIP. It covers Arc's "Bridge" template for the chains Avalanche users most often move to. For moves between Avalanche chains, use `ictt-token-bridge` instead: ICTT stays inside Avalanche's own validator security.

## Two ways to send

1. **Straight from the wallet** (no contract). Approve the CCIP router for the USDC amount, quote `router.getFee(selector, message)`, then call `router.ccipSend{value: fee}(selector, message)` with `tokenAmounts: [{ token: USDC, amount }]`, `receiver: abi.encode(receiver)` and `feeToken: address(0)`. Use this for a simple "send USDC to Base" button.
2. **Through `CCIPTokenTransferor`** (this blueprint). Use it when the app needs its own rules: a destination allowlist, one entry point for fees, refunds of excess native fee, and a place to add logic such as limits or fee sharing.

## What gets deployed

1. `CCIPTokenTransferor(router, deployer)` on Fuji C-Chain, with the router from `$net.source.ccip.router`.
2. `allowlistDestinationChain(selector, true)` for the chosen destination, then `transferOwnership` to the builder.
3. A test transfer:
   - encode `extraArgs` off-chain for the lane;
   - quote `getFee`;
   - approve the USDC amount;
   - call `transferTokens` with the fee as `value`;
   - wait for CCIP delivery, then check the receiver's USDC balance on the destination.

Nothing is deployed on the destination: token-only messages go straight to the receiver's address.

## extraArgs on CCIP 2.0

Lanes from Fuji run CCIP 2.0. Encode `extraArgs` off-chain with `@chainlink/ccip-sdk`, which picks V3 on 2.0 lanes and legacy V2 on older ones, and pass it into the call. Never hardcode it: a future CCIP version would otherwise need a redeploy. Token-only transfers use a gas limit of 0, because no receiver code runs.

## Fees

`feeToken = address(0)` pays in native AVAX: send at least the quoted fee, and the contract refunds any excess. To pay in LINK, which is in the registry, approve the transferor for the quoted LINK fee as well, and send no native value.

## Adapting it

- **Other tokens**: CCIP-BnM is transferable on every registry lane and is the standard test token. Other tokens must have a CCIP token pool on the lane. Check `transferableTokens` in the registry, or the router's supported tokens.
- **Data with the tokens**: use a receiver contract on the destination, as in `ccip-messenger`, and put a payload in `data`. The receiver then needs a real gas limit in `extraArgs`.
- **Your own token cross-chain**: that needs a CCIP token pool registered for the token (the Cross-Chain Token standard). It is not covered here.

## Pitfalls

- Delivery waits for source finality by default. From Fuji that is fast, but the whole trip, including destination execution, can take many minutes. Show progress rather than a spinner.
- Lanes enforce rate limits. Large test amounts can revert. Keep them small.
