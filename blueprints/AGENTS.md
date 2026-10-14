# Working in blueprints/

Guidance for coding agents (Cursor, Claude Code, Codex) editing blueprints. The hosted Studio agent gets the same rules through `_shared/agent.md`.

## Skills

Read these before the matching task:

- `_shared/skills/testing/SKILL.md`: writing and running Foundry tests (unit, fuzz, invariant, ICM and CCIP).
- `_shared/skills/auditing/SKILL.md`: static detectors, the OWASP 2026 review, severity, and the production gate.

## Commands

```bash
npm run blueprints:deps     # pinned Solidity dependencies into .blueprint-deps/ (needs curl and git)
npm run blueprints:test     # forge test over every blueprint
npm run blueprints:audit    # compile every blueprint and run the audit gate
./node_modules/.bin/vitest run tests/unit/blueprints tests/unit/studio
```

All four must pass before a change is done. CI runs them in `.github/workflows/blueprints-ci.yml`.

## Rules

- **Addresses come from `_shared/networks.json`,** checked on-chain, with `verifiedAt` updated. Contracts take them as constructor arguments. The validator rejects 40-hex literals in manifests, guides and sources.
- **Compiler settings come from `_shared/compiler.json`** (solc 0.8.28, cancun, optimizer 200). Verification replays them. A dependency bump updates `dependencies`, `integrity` and `scripts/blueprints/setup-test-deps.sh` together; a unit test keeps them in sync.
- **Every contract has tests** in `<id>/test/`, and every blueprint with contracts has at least one test file (enforced).
- **Measure cross-chain gas limits** with the harness, and state the measurement in the guide and the parameter description.
- **Keep the reference contracts audit-clean.** No critical, high or medium findings. Informational notes are fine.
- **`frontend` describes the end-user app, not the contract:**
  - `summary`, `audience` and `journeys` say who opens it and what they come to do, in their words. No function names there.
  - `flows` are the implementation notes for how those journeys call the contracts.
  - Owner-only actions belong in an owner area, not in the main journeys.
- **Guides are written for a model:** what gets deployed, in what order, how to adapt it, and the pitfalls. Use plain sentences, the registry reference instead of any address, and link to `/docs`, `/academy` or `/console` pages that exist.
