# Blueprints

Templates the Builder Hub build agent uses to turn a request into a working app on Avalanche. Each blueprint pairs reference contracts that compile under shared settings with a manifest the deploy pipeline can walk, and a guide written for the model. The model runs on Builder Hub's key, so the blueprints are how we steer it: verified addresses, proven contracts, and explicit steps instead of guesses.

## Catalog

| Blueprint | Category | What it builds | Networks |
| --- | --- | --- | --- |
| `guestbook` | Data | Permanent onchain guestbook | C-Chain or any L1 |
| `price-tracker` | Data | Chainlink price reads with staleness checks | C-Chain |
| `usdc-checkout` | Payments | Storefront checkout with permit, refunds, withdrawals | C-Chain |
| `creator-tips` | Payments | Handle-based profiles with direct USDC tips | C-Chain |
| `usdc-escrow` | Payments | Buyer and seller escrow with a per-deal arbiter | C-Chain |
| `erc20-token` | DeFi | ERC-20 with permit and a lifetime supply cap | C-Chain or any L1 |
| `icm-messenger` | Interop | Authenticated two-way messages over ICM | C-Chain and L1s |
| `icm-price-oracle` | Interop | Chainlink prices pushed or requested from an L1 over ICM | C-Chain to L1 |
| `ictt-token-bridge` | Interop | ERC-20 bridge between Avalanche chains with ICTT | C-Chain and L1s |
| `usdc-gas-l1` | Interop | USDC bridged in as an L1's native gas token | C-Chain to L1 |
| `ccip-usdc-bridge` | Interop | USDC from the C-Chain to Ethereum, Base, Arbitrum, OP | C-Chain to EVM testnets |
| `ccip-messenger` | Interop | Two-way messages with other EVM chains over CCIP 2.0 | C-Chain and EVM testnets |
| `ccip-usdc-to-l1` | Interop | USDC from Base, Ethereum, Arbitrum or OP to your L1: CCIP to the C-Chain, then ICTT | EVM testnets to C-Chain to L1 |
| `icm-identity-layer` | Interop | KYC once on the C-Chain, prove yes/no claims on any L1 over ICM without personal data | C-Chain and L1s |
| `eerc-private-usdc` | Privacy | Encrypted ERC converter: confidential USDC with an auditor | Fuji C-Chain |
| `eerc-private-token` | Privacy | Encrypted ERC standalone token with private mints | Fuji C-Chain |
| `l1-quickstart` | Infra | A Subnet-EVM L1 on Fuji through the Quick L1 service | Fuji |
| `l1-icm-setup` | Interop | Finishes ICM on an L1: Teleporter registry, then a relayer check | Your L1 |

## Layout

```
blueprints/
  AGENTS.md            rules for coding agents working in this folder
  foundry.toml         the Foundry project every blueprint's tests run in
  _shared/
    networks.json      every address, chain ID, selector and endpoint, checked on-chain
    compiler.json      solc version, optimizer, EVM version, pinned dependencies and their sha256, remappings
    agent.md           the agent's workflow and hard rules (system prompt)
    review.md          the pre-deploy review; any fail blocks the deploy
    deploy.md          how steps become transactions, evidence, verification, panels
    skills/            testing and auditing skills, for the Studio agent and coding agents
    contracts/teleporter/   ICM interfaces, imported as @teleporter/...
    test/              shared test helpers: mocks, a CCIP router mock, the Teleporter/ICTT harness
  <id>/
    blueprint.json     manifest (schema in lib/blueprints/schema.ts)
    GUIDE.md           instructions for the model: what, steps, adapting, pitfalls
    contracts/*.sol    reference contracts, for blueprints that need new code
    test/*.t.sol       Foundry tests for those contracts
```

Blueprints built on audited Ava Labs contracts (ICTT, Teleporter, Encrypted ERC) point at the precompiled artifacts under `contracts/` instead of shipping Solidity.

## Manifest essentials

- **`networks`** declares roles, such as `main`, `home`/`remote` or `source`/`destination`. Each role names a default and its allowed networks from `networks.json`. `l1` is the builder's own chain, bound at run time from the `l1-quickstart` result.
- **`params`** are what the builder may set. A parameter without a `default` is required.
- **`steps`** run in order. Each step has a `kind`:
  - `deploy`: bytecode from `contracts[].source` or `artifact`.
  - `call` and `read`: a function on a `target` address.
  - `offchain`: a platform action such as `quick-l1.deploy`, `icm.ensure-relayer`, `ccip.encode-extra-args` or an `eerc.*` browser operation.
  - `wait`: for ICM or CCIP delivery, or a Quick L1 job.

  Steps name a `signer` (`deployer`, `builder` or `admin`), may declare `outputs`, and may be `optional` or skipped with `skipIf`.
- **`checks`** are view calls run after a named step. `expect` compares the first return value (for a struct, its first field) using `equals`, `gt`, `gte` or `nonZero`.
- **`panel`** lists the read and write functions to show for each deployed contract.
- **`review`** adds blueprint-specific items to `_shared/review.md`.

Values that aren't literals are references, always a whole string:

| Reference | Resolves to |
| --- | --- |
| `$param.amount` | A builder parameter |
| `$net.home.tokens.USDC.address` | A registry value on the network bound to the role |
| `$net.remote` | The whole bound network entry (used by off-chain actions) |
| `$reg.precompiles.nativeMinter` | A registry value from the root |
| `$out.deploy-home.address` | An earlier step's `address`, `txHash`, or declared output |
| `$ctx.builder`, `$ctx.deployer` | The builder's wallet and the signing deployer |

Large integers are decimal strings. Struct arguments are objects keyed by the ABI's component names.

## How the model uses them

1. The system prompt carries `_shared/agent.md` plus `formatCatalogForModel()` from `lib/blueprints`.
2. When a request matches, the agent loads `formatBlueprintForModel(id, { bindings })`. That returns the guide, the manifest, the reference contracts, and every registry value the manifest references, already resolved for the bound networks, so the model never types an address from memory.
3. The agent adapts the contracts, runs `_shared/review.md`, and hands the steps to the deploy pipeline in `_shared/deploy.md`: compile with `lib/verification/solc.ts`, simulate, sign, record evidence, verify on the Builder Hub verifier, and show the panel.

The loader reads from disk. An API route that uses it needs `./blueprints/**/*` in that route's `outputFileTracingIncludes`.

## Adding or changing a blueprint

1. Put every new address or endpoint in `_shared/networks.json`, after checking it on-chain, and update `verifiedAt`.
2. Write the contracts against `_shared/compiler.json`. Take external addresses as constructor arguments; never hardcode them.
3. Write `blueprint.json` and `GUIDE.md`. Reference the registry instead of pasting addresses: the validator rejects 40-hex literals other than the zero address in manifests, guides and sources.
4. Write Foundry tests in `<id>/test/` (see `_shared/skills/testing/SKILL.md`).
5. Run the checks below. They must all pass.

## Testing and audits

```bash
npm run blueprints:deps     # once: forge-std, OpenZeppelin 5.3.0 and CCIP 2.0.0 at pinned commits and checksums
npm run blueprints:test     # forge test: unit, fuzz and invariant tests for every blueprint
npm run blueprints:audit    # compile each blueprint with compiler.json and run the audit gate
vitest run tests/unit/blueprints tests/unit/studio
```

- **Foundry suite**: ICM and ICTT tests run against the real TeleporterMessenger, TeleporterRegistry and ICTT bytecode from `contracts/icm-contracts/compiled`. A Warp stand-in charges the precompile's gas, so delivery gas limits are measured rather than guessed. CCIP tests use `MockCCIPRouter`, which charges a fee, moves tokens like the router and delivers like the OffRamp.
- **Audit gate**: `lib/studio/audit` runs 30 detectors over solc's AST, each mapped to the OWASP Smart Contract Top 10 (2026). Critical and high findings fail the command. The same engine audits Studio projects before deploys and promotions. See `_shared/skills/auditing/SKILL.md`.
- **Validation**: `tests/unit/blueprints` checks:
  - schemas and every reference, across every allowed network;
  - step ordering;
  - ABI arity and event names for artifact-backed contracts;
  - panel mutability;
  - doc links and related blueprints;
  - that every blueprint with contracts has tests;
  - that the registry's eERC addresses match `constants/eerc-deployments.json`.

CI runs all of it in `.github/workflows/blueprints-ci.yml`.
