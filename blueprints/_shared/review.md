# Pre-deploy review

Run this before every deploy, plus the `review` items in the blueprint's manifest. Report each item as pass, fail, or not applicable, with one line of evidence. Any fail blocks the deploy until it is fixed.

## Every contract

- **compile**: Compiles with zero errors under the shared settings. Every warning is read and either fixed or explained.
- **access**: Every state-changing admin function is access-controlled. The final owner is the builder's address, not the platform deployer, unless the builder asked otherwise. If the deployer is the initial owner, a later step transfers ownership.
- **funds**: Any function that moves value follows checks-effects-interactions, uses `SafeERC20` for tokens, and is `nonReentrant` when it makes an external call after changing state.
- **inputs**: Addresses are non-zero, amounts are positive, strings and arrays have length caps, and loops are bounded.
- **units**: Amounts are in the token's base units, using the decimals from the registry.
- **addresses**: External addresses such as tokens, routers, messengers and feeds arrive through constructor arguments resolved from `networks.json`. Nothing is hardcoded.
- **events**: Every state change the frontend or a backend has to follow emits an event.
- **mutability**: Trusted addresses are immutable by default. A setter that can swap a router, messenger or feed is justified in the review.
- **network**: The target is a testnet unless the builder chose mainnet and signs it with their own wallet.

## Cross-chain with ICM

- **icm-sender**: `receiveTeleporterMessage` rejects any caller other than the TeleporterMessenger.
- **icm-origin**: The receiver checks `(sourceBlockchainID, originSenderAddress)` against an allowlist.
- **icm-gas**: `requiredGasLimit` covers the receiver's worst case, meaning the largest allowed payload, including any reply it sends.
- **icm-relayer**: A relayer serves this pair of chains.
- **icm-retry**: The handler is safe if a failed delivery is retried later with `retryMessageExecution`.

## Cross-chain with CCIP

- **ccip-allowlist**: Senders allowlist destination chains. Receivers allowlist `(sourceChainSelector, sender)` in both `_ccipReceive` and `getCCVsAndFinalityConfig`.
- **ccip-extraargs**: `extraArgs` is a call argument or an owner-updatable setting, never a constant.
- **ccip-fees**: The fee is quoted with `getFee` in the same transaction, and native `msg.value` or LINK approvals cover it. Leftover native or tokens can be withdrawn by the owner.
- **ccip-lane**: The token is supported on the lane and the amount is within the lane's rate limit.

## Tokens and payments

- **approvals**: The frontend approves the exact amount, or uses EIP-2612 permit, rather than an unlimited allowance.
- **refunds**: Refund and withdrawal paths exist, or the guide states they are out of scope.

## eERC

- **eerc-client**: Key derivation and proof generation run in the browser. The server never sees a decryption key.
- **eerc-auditor**: An auditor public key is set before any private transfer.
- **eerc-units**: Amounts use eERC's 2 decimals. Converter deposits refund the dust that does not fit.
