---
name: blueprint-auditing
description: Audit Builder Hub blueprint and Studio contracts before a deploy or a promotion to production. Covers running the static detectors, reviewing against the OWASP Smart Contract Top 10 (2026) and review.md, classifying severity, fixing or acknowledging findings, and recommending a professional audit. Use before any deploy, before migrating to production, or when asked to review contract security.
---

# Auditing contracts

An audit here has three layers, all required before production: the static detectors, a manual review, and tests that pin down the properties the review relies on. None of them makes a contract "secure". Say what was checked, never that nothing can go wrong.

## 1. Static detectors

```bash
npm run blueprints:audit                 # every blueprint, compiled with the shared settings
npm run blueprints:audit -- usdc-escrow  # one blueprint
```

In Studio, the `audit` tool runs the same 30 detectors (`lib/studio/audit`) on the project's files and stores the report.

- The detectors work on solc's AST and are intraprocedural heuristics. They catch the common generated-code mistakes: missing access control, reentrancy, unchecked calls, unauthenticated cross-chain receivers, stale oracles, unsafe casts and more. Each maps to an OWASP 2026 category.
- **Critical and high findings block the deploy.** Fix them. Acknowledge one only with a concrete reason it cannot be exploited here; the acknowledgement is recorded with the report. Never acknowledge access-control or reentrancy findings in a contract that holds funds.
- Medium findings block **promotion to production** until they are fixed or acknowledged.

## 2. Manual review

Walk the OWASP Smart Contract Top 10 (2026), then `_shared/review.md` and the blueprint's own `review` items. Report each item as pass or fail, with one line of evidence.

| OWASP 2026 | What to check here |
| --- | --- |
| SC01 Access Control | Who can call each state-changing function. Ownership ends with the builder, and initializers are locked. Cross-chain receivers authenticate the messenger or router and the source chain and sender. |
| SC02 Business Logic | State machines can't skip or repeat states. Refund and withdrawal paths exist, and fees and rounding favor the protocol. Write the invariants you rely on as invariant tests. |
| SC03 Price Oracle | Chainlink answer > 0 and within the feed's heartbeat. Read decimals from the feed. |
| SC04 Flash Loans | No value, price or voting power comes from balances or reserves read in the same transaction. |
| SC05 Input Validation | Zero addresses, amount bounds, length caps on strings and arrays, and chain IDs or selectors from the registry. Decode cross-chain payloads defensively. |
| SC06 Unchecked Calls | SafeERC20 everywhere, low-level results checked. Receivers `try` the second leg and hold funds on failure. |
| SC07 Arithmetic | Multiply before dividing, or use `Math.mulDiv`. Scale decimals correctly: USDC 6, eERC 2, most tokens 18. |
| SC08 Reentrancy | Checks-effects-interactions plus `nonReentrant` on functions that call out, including cross-function and ERC-721/1155/777 hooks. |
| SC09 Overflow | Every `unchecked` block states its bound. Downcasts go through SafeCast. |
| SC10 Upgradeability | Blueprints are immutable by default. If a proxy is truly needed, require `_disableInitializers()`, a guarded `_authorizeUpgrade` behind a timelock, and ERC-7201 namespaced storage. |

Avalanche and interop specifics:

- **ICM**:
  - `requiredGasLimit` covers the worst case, measured with the harness.
  - Handlers are safe to retry with `retryMessageExecution`.
  - Use `TeleporterRegistryApp` with a minimum version for long-lived apps.
  - Nothing trusts `block.prevrandao`; it is not random on Avalanche.
- **ICTT**:
  - Remotes are registered, and native remotes are collateralized before use.
  - Decimal scaling is set.
  - Bridging back needs an approval on the remote.
- **CCIP 2.0**:
  - Allowlist `(sourceChainSelector, sender)` in both `_ccipReceive` and `getCCVsAndFinalityConfig`.
  - `bytes4(0)` (full finality) unless the owner accepts reorg risk.
  - `extraArgs` is never hardcoded, fees are quoted and excess refunded, and tokens have pools on the lane.
- **eERC**: keys and proofs stay in the browser, an auditor key is set before transfers, and balances use 2 decimals.
- **Precompiles**: Native Minter and allowlist admins are the builder, never a contract anyone can call.

## 3. Severity

Rate by impact and likelihood:

| Severity | Meaning |
| --- | --- |
| Critical | Anyone can steal funds, take over the contract, or brick it. |
| High | Loss or takeover under realistic conditions, or by a privileged but untrusted party. |
| Medium | Conditional loss, griefing, or DoS. |
| Low | Best-practice gaps. |
| Info | Notes. |

## 4. Report

For each finding, give:

- title, severity and OWASP category;
- location (file, line, function);
- what goes wrong and a concrete exploit scenario;
- the fix;
- status: fixed, or acknowledged with the reason.

Close with what was out of scope, for example off-chain services, the frontend, or third-party contracts.

## 5. Production

Promotion is gated on the server. It requires:

- a passing audit of the exact build being promoted;
- no unacknowledged critical, high or medium finding;
- a successful testnet deployment of the same bytecode with every check passing;
- the builder's confirmation that the Foundry tests pass.

For contracts that will hold meaningful value, recommend a professional audit through Builder Hub's audit marketplace at `/audits/new`, where vetted firms quote on the project. Say so plainly in the promotion summary.
