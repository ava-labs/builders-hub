# USDC from Any Chain to Your L1

Users of your L1 hold USDC on Base, Ethereum, Arbitrum or OP. This blueprint lets them move it to your L1 in one transaction on their chain. Paired with `usdc-gas-l1`, that becomes a one-click gas top-up.

## Route

```
source chain                   Avalanche C-Chain                                Your L1
USDCToL1Sender --CCIP-->  L1Gateway --ICTT send--> ERC20TokenHome --ICM-->  TokenRemote --> recipient
  (USDC + recipient)       (CCIP receiver)          (locks USDC)                (mints, or native gas)
```

1. `sendToL1(recipient, amount, feeToken, extraArgs)` on the source pulls the USDC and sends a CCIP programmable token transfer. The USDC goes to the gateway, with the L1 recipient as data.
2. The CCIP OffRamp releases USDC to `L1Gateway` and calls `ccipReceive`. The gateway checks the sender allowlist and the token, records the transfer, and calls `ERC20TokenHome.send` toward your L1, all in the same execution.
3. The ICM relayer delivers the ICTT message, and the TokenRemote on the L1 credits the recipient: ERC-20 for `ERC20TokenRemote`, native gas for `NativeTokenRemote`.

## Prerequisite bridge

You need a USDC ICTT bridge between Fuji C-Chain and your L1 that is registered and, for native remotes, collateralized. Run `usdc-gas-l1`, or `ictt-token-bridge` with USDC, and pass its TokenHome and TokenRemote as `tokenHome` and `tokenRemote`.

## Failure handling

The ICTT leg can fail even when CCIP succeeds: the remote isn't registered yet, collateral is short, or a Teleporter version is paused. The gateway wraps `send` in `try/catch`:

- **Forwarded**: the normal case. `ForwardedToL1(ccipMessageId, recipient, amount)` is emitted.
- **Held**: the USDC stays in the gateway and `ForwardHeld(..., reason)` is emitted. Anyone can call `retry(ccipMessageId)` once the bridge is fixed. The recipient, who controls the same address on the C-Chain, can call `refundHeld(ccipMessageId, to)`, and the owner can refund on the recipient's behalf.
- **Refunded**: final.

The CCIP execution itself only fails if `extraArgs` carries too little gas, or if the sender or token is wrong. A failed execution stays on the OffRamp and can be executed again manually from the CCIP explorer.

## Gas

Measured end to end against the real ICTT and Teleporter bytecode:

- `L1Gateway.ccipReceive`, including the TokenHome send and the Teleporter message: about 307,000 gas. `gatewayGasLimit` defaults to 500,000. Encode it into `extraArgs`.
- ERC20TokenRemote crediting the recipient on the L1: about 77,000. `l1GasLimit` defaults to 250,000, the console's ICTT default.

## Adapting it

- **More source chains**: deploy one sender per chain and `allowlistSender` each on the gateway. USDC must have a CCIP pool on that lane; the registry lists `transferableTokens`.
- **Other tokens**: the same pattern works for any token with both a CCIP pool and an ICTT home on the C-Chain. Keep the single-token check.
- **Deposit into an app on arrival**: use ICTT `sendAndCall` in the gateway so the L1 remote calls your contract with the tokens.
- **Leaving the L1**: reverse the route. Bridge L1 to C-Chain with ICTT, then C-Chain to the destination with `ccip-usdc-bridge`.

## Pitfalls

- The recipient address must be one the user controls on both chains. That is true for EOAs; be careful with smart accounts deployed on one chain only.
- Faster-than-finality stays off (`bytes4(0)`) unless the owner accepts the reorg risk for a source chain.
