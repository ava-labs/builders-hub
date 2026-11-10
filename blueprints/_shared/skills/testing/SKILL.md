---
name: blueprint-testing
description: Write and run Foundry tests for Builder Hub blueprint and Studio contracts, covering unit, fuzz, invariant and cross-chain tests (ICM through the real Teleporter bytecode, CCIP through a router mock). Use when creating or changing a contract under blueprints/ or in a Studio project, or when a deploy or promotion is blocked on missing tests.
---

# Testing blueprint contracts

Every contract ships with Foundry tests next to it, in `<blueprint>/test/<Contract>.t.sol`. A change to a contract is done only when its tests pass and cover the change.

## Run

```bash
npm run blueprints:deps               # once: pinned forge-std, OpenZeppelin 5.3.0, CCIP 2.0.0
cd blueprints && forge test           # everything
forge test --match-path 'usdc-escrow/**' -vvv
FOUNDRY_PROFILE=ci forge test         # 1024 fuzz runs, as CI does
forge lint                            # no warnings allowed in contracts/
```

Shared helpers are imported as `@blueprints-test/...`:

| File | Use it for |
| --- | --- |
| `Mocks.sol` | `MockUSDC` (6 decimals, EIP-2612 permit, open `mint`), `MockToken`, `MockAggregator` |
| `MockCCIPRouter.sol` | Charges `FEE`, pulls tokens like the router, and delivers like the OffRamp: `deliver`, `deliverWithTokens`, `lastMessage` |
| `TeleporterHarness.sol` | Real TeleporterMessenger, TeleporterRegistry and ICTT bytecode from `contracts/icm-contracts/compiled`, with a Warp stand-in that charges the precompile's gas. `_deliver` returns the gas the receiver used. |

## What every contract needs

1. **Wiring**: constructor arguments land where expected, the owner is the builder, and zero addresses revert.
2. **Each external function**: the happy path, plus every revert. Assert the exact custom error: `vm.expectRevert(abi.encodeWithSelector(C.Err.selector, arg))`.
3. **Events**: `vm.expectEmit(address(c))`, then emit the expected event, then make the call.
4. **Access control**: every privileged function reverts for `makeAddr("stranger")`.
5. **Fuzz** anything with amounts, fees or time. Constrain with `bound(x, lo, hi)`, not `vm.assume`, which discards runs.
6. **Invariants** for anything that holds funds. Use a handler contract with bounded actions and ghost variables, `targetContract(address(handler))`, and an invariant such as "the escrow's USDC balance equals the sum of open deals". `usdc-escrow/test` is the template.
7. **Cross-chain**:
   - Deliver ICM messages through `TeleporterHarness._deliver`. Assert the returned gas stays well below the `requiredGasLimit` you ship.
   - Deliver CCIP through `MockCCIPRouter`.
   - Always test that impostor senders, wrong chains and replays are rejected, and that a failing second leg holds funds instead of losing them.
8. **Gas**: assert the cross-chain delivery budgets. Use `forge snapshot --diff` to catch regressions.

Name tests so failures read as sentences: `test_ReleasePaysSeller`, `test_RevertWhen_CallerIsNotBuyer`, `testFuzz_FeeNeverExceedsAmount`, `invariant_BalanceEqualsOpenDeals`.

## Pitfalls this repo has hit

- `vm.prank` and `vm.expectRevert` apply to the **next external call**, including calls made while evaluating arguments, such as `router.FEE()` or a helper that reads another contract. Compute values into locals first.
- `ERC20TokenRemote.send` pulls from the caller. Approve the remote itself before bridging back.
- USDC has 6 decimals, and eERC balances have 2. Never assume 18.
- Fork tests pin a block: `vm.createSelectFork(vm.envString("FUJI_RPC_URL"), 12345678)`. Skip cleanly without an RPC: `if (!vm.envOr("RUN_FORK_TESTS", false)) return;`.
- Circle's FiatToken is a proxy. On forks, fund accounts from a holder or a faucet instead of `deal`.

## Beyond unit tests

- **Chainlink Local** (`@chainlink/local`, `CCIPLocalSimulatorFork`) for end-to-end CCIP on forked testnets.
- **Symbolic checks** with Halmos (`check_` functions) for small arithmetic properties such as fee math.
- **Mutation testing** (Gambit, vertigo-rs) finds tests that execute code without asserting on it.
- **Coverage**: `forge coverage --report summary`. Add `--ir-minimum` if you hit "stack too deep".

## Studio projects

The Studio agent writes `test/<Contract>.t.sol` next to every contract it creates or changes, using the helpers above. It cannot run Foundry on the server, so testnet deploys rely on compile, audit and simulation. The project export is a Foundry project, so the builder can run `forge test` locally or in CI, and promotion to production asks for that confirmation.
