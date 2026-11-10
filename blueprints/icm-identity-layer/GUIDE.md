# Private Identity over ICM

A user completes KYC once, with an issuer, and proves it on any Avalanche L1 without that L1 learning who they are. ICM is the transport: the C-Chain is the identity hub, and each L1 keeps a small gate that its apps query.

## Privacy model

| Where | What is stored or sent |
| --- | --- |
| Issuer's own systems | The real evidence: documents, checks, results |
| `IdentityHub` on the C-Chain | Per subject and claim: issuer, expiry, revoked flag, and a salted hash of the evidence |
| ICM message to an L1 | `(kind, account, claimType, expiresAt, sequence)`: five words, nothing else |
| `IdentityGate` on the L1 | Per account and claim: expiry and last sequence |

Personal data never leaves the issuer. Claims are yes/no predicates, such as "over 18" rather than a birth date, so each share discloses one fact. Users choose, per claim, which L1s learn it. They also choose the **account** it is bound to on that L1, and a fresh account is the default suggestion, so L1 apps don't see the C-Chain address.

**Limit, stated plainly:** `share` is a public transaction on the C-Chain, so someone watching both chains can link the C-Chain address to the L1 account. Breaking that link needs zero-knowledge membership proofs, such as a Semaphore-style group per claim. That is noted below as an extension, not something this blueprint provides.

## What gets deployed

1. The relayer check.
2. `IdentityHub(messenger, deliveryGasLimit, deployer)` on the C-Chain.
3. `IdentityGate(messenger, hubBlockchainIdHex, hub)` on the L1. The hub is immutable, so no one can repoint the gate.
4. `setTrustedGate(l1, gate)` and `setIssuer(issuer)` on the hub.
5. `CompliantToken(name, symbol, gate, claimType, owner)` on the L1: an example app that only moves between verified accounts.
6. `transferOwnership(owner)`, then `acceptOwnership()` from the builder. The hub is `Ownable2Step`.
7. Optional smoke test: the builder attests themselves as issuer, shares the claim with the L1, waits for delivery, and checks `hasClaim`.

## Lifecycle

- **Attest**: `attest(subject, claimType, expiresAt, evidenceCommitment)`. Only allowlisted issuers can call it. Re-attesting renews the claim; the subject shares again to push the new expiry.
- **Share**: `share(claimType, blockchainID, gate, account)`, called by the subject. Sharing again with the same gate refreshes the claim. With a new account, it first revokes the old account on that L1.
- **Revoke**: `revoke(subject, claimType)`, by the issuer or the owner. It sends a revocation to every chain the claim was shared with, at most `MAX_SHARES_PER_CLAIM` (8).
- **Withdraw consent**: `unshare(claimType, blockchainID, gate)`, by the subject.
- **Local erasure**: `forget(claimType)` on the gate, by the account itself.

## Ordering and retries

ICM does not order deliveries. Every hub message carries a strictly increasing `sequence`, and the gate ignores anything at or below the last one it applied. A share that arrives after a newer revocation is dropped. The tests cover this, including the account-move case, where two messages are sent in one transaction.

## Gas

Measured against the real TeleporterMessenger:

- A gate applying a share uses about 26,000 gas, against a `deliveryGasLimit` of 150,000.
- `share` costs the user about 256,000 on the C-Chain, including the Teleporter send.
- `revoke` costs about as much per shared chain.

## Adapting it

- **More claim types**: use `keccak256("ACCREDITED")`, `keccak256("OVER_18")` and so on. Issuers attest each type separately.
- **Gating any app**: call `identityGate.hasClaim(msg.sender, CLAIM)` in a modifier, as `CompliantToken._update` does for transfers.
- **Several issuers per claim**: the hub keeps one attestation per subject and claim, and the latest issuer wins. Key by issuer instead if apps need to choose issuers.
- **Unlinkability (extension)**: replace `share` with a Semaphore-style group per claim on each L1. The hub publishes group roots over ICM, and users prove membership with a zero-knowledge proof from a fresh address.

## Pitfalls

- Removing an issuer stops new shares of its attestations, but existing L1 records last until they expire or are revoked. Use short expiries for high-risk claims.
- A claim's expiry is only as fresh as the last share. Build renewal reminders into the user flow.
