# Token Launch

An ERC-20 built from OpenZeppelin 5.3: `ERC20`, `ERC20Burnable`, `ERC20Permit` and `Ownable`. It is the starting point for anything that needs a token, and the source token for `ictt-token-bridge`.

## What gets deployed

`LaunchToken(name, symbol, initialSupply, maxSupply, initialHolder, owner)` on the `main` network.

- `initialSupply` is minted to `initialHolder` at deployment.
- `maxSupply` caps lifetime issuance, tracked in `totalMinted`. Burning does not free room to mint again.
- With `maxSupply == initialSupply` (the default) the supply is fixed and `mint` always reverts.
- The owner is set in the constructor, so the platform deployer never holds admin rights.

## Converting amounts

The token has 18 decimals. Convert human amounts with `parseUnits(amount, 18)` before passing them. One million tokens is `1000000000000000000000000`.

## Adapting it

- **No minting ever**: keep the default and suggest `renounceOwnership()` after launch.
- **Different decimals**: override `decimals()`. Update every amount in the manifest to match.
- **Governance voting**: add `ERC20Votes` and resolve its `nonces` override conflict with `ERC20Permit`, as the OpenZeppelin Wizard does.
- **Transfer restrictions**: on an L1, prefer the transactor allowlist precompile over custom token logic.

## Pitfalls

- Name and symbol are permanent. Confirm them with the builder before deploying.
- `ERC20Permit` uses the token name as the EIP-712 domain name. Frontends signing permits must use the same name and version "1".
