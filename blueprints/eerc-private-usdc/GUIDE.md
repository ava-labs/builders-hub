# Private USDC Payments

Encrypted ERC (eERC) is Ava Labs' confidential-token protocol, from `ava-labs/EncryptedERC`. It uses zk-SNARKs and partially homomorphic encryption, and it runs entirely on-chain, with no relayers or off-chain operators. In **converter mode** it wraps an existing ERC-20: public USDC goes in, encrypted balances come out, and amounts moved between users stay hidden on-chain. A designated auditor can decrypt, which is what makes it usable for payroll, B2B payments and treasury.

## What stays private, and what doesn't

- **Hidden**: every user's balance, and the amount of every private transfer.
- **Public**: that a transfer happened and between which addresses; deposit and withdrawal amounts, since USDC moves publicly at those edges; and who is registered.
- **Auditor**: decrypts all amounts. Choose the auditor deliberately, and rotate it with `setAuditorPublicKey`.

## What gets deployed

1. `EncryptedERC` with `isConverter: true` and 2 decimals, the protocol constant.
   - It reuses Fuji's shared Registrar, the five Groth16 verifiers and the BabyJubJub library from the registry, so this is a single transaction.
   - Those verifiers match the circuits the Builder Hub serves at `/eerc/circuits`.
2. The auditor registers a BabyJubJub key, if they haven't already. Then `setAuditorPublicKey(auditor)`.
3. `transferOwnership(owner)`, then `acceptOwnership()` from the builder's wallet. Ownership is two-step.
4. Smoke test: the builder registers, approves USDC, deposits 1 USDC, and decrypts their own balance.

## Where the cryptography runs

Everything secret happens in the builder's browser:

- **Keys**: `lib/eerc/identity.ts` and `lib/eerc/crypto/key.ts` derive the BabyJubJub private key deterministically from a wallet signature. The same wallet always gets the same key.
- **Proofs**: `lib/eerc/proof.ts` runs snarkjs with `/eerc/circuits/<kind>/<kind>.{wasm,zkey}`.
- **Operations**: `lib/eerc/register.ts` and `lib/eerc/operations/{deposit,transfer,withdraw}.ts` build the calldata.
- **SDK alternative**: `@avalabs/ac-eerc-sdk`, already a dependency, covers the same flows.

Never generate these on the server, never log signatures, and never store decryption keys.

## Amounts

eERC balances have 2 decimals. A deposit of `1000000` USDC base units becomes 100 cents, which displays as 1.00. Anything below a cent is refunded to the depositor (see `computeDepositCents`).

## Zero-deploy alternative

For a quick demo, the canonical Fuji converter (`$net.main.eerc.converter`) already works with the console tools. Its auditor is Ava Labs' address, not the builder's, so use your own converter for anything real.

## Pitfalls

- Recipients must be registered before they can receive a private transfer. Check `Registrar.isUserRegistered(to)` in the UI.
- Proof generation takes seconds. Show progress, and generate transfer proofs in a Web Worker.
- Gas is high by EVM standards: about 950,000 for a transfer and 560,000 for a deposit on the C-Chain. That is fine on Avalanche fees, but show it before users sign.
