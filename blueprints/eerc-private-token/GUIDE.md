# Private Token

A new token whose balances, transfer amounts and total supply are encrypted, built on Encrypted ERC in **standalone mode**. Supply comes from private mints by the owner. Use it for confidential points, rewards, or permissioned securities where an auditor still has to see everything.

For wrapping an existing token such as USDC, use `eerc-private-usdc` (converter mode) instead.

## What gets deployed

1. `EncryptedERC` with `isConverter: false`, the builder's name and symbol, and 2 decimals, the protocol constant.
   - On Fuji it reuses the shared Registrar, verifiers and BabyJubJub library from the registry.
2. The auditor registers, if needed, then `setAuditorPublicKey(auditor)`.
3. `transferOwnership(owner)`, then `acceptOwnership()` from the builder.
4. Optional smoke test: the builder registers, privately mints 100.00 to themselves, and decrypts the balance.

## Minting

`privateMint(user, proof)` is owner-only. The owner's browser builds a mint proof that encrypts the amount to the recipient's public key and to the auditor's, so the chain learns neither the amount nor the new total supply.

The mint circuit is served at `/eerc/circuits/mint`. `lib/eerc` has register, deposit, transfer and withdraw operations but no mint yet. Use `@avalabs/ac-eerc-sdk`, or add `lib/eerc/operations/mint.ts` modelled on the deposit operation. Keep proving in the browser.

## On other chains

The shared infrastructure exists only on Fuji. On an L1 or mainnet, deploy the whole set with the console's eERC deploy flow (`/console/encrypted-erc/deploy`):

1. BabyJubJub.
2. Five verifiers.
3. The Registrar.
4. EncryptedERC, linked against BabyJubJub.

Use the verifier artifacts in `contracts/encrypted-erc/compiled/verifiers`, which match the hosted circuits. For production, the EncryptedERC README says to use the production verifiers, built from a trusted setup.

## Pitfalls

- A holder who loses access to their wallet loses their balance, because the key is derived from the wallet's signature. There is no recovery by design.
- Recipients must register before they can receive mints or transfers.
- The same BabyJubJub identity works across every eERC that shares a Registrar, so users register once on Fuji.
