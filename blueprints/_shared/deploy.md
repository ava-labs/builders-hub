# Deploy pipeline

How a blueprint's `steps` become transactions. Every step leaves evidence in the same shape the Quick L1 orchestrator uses (`StepEvidence` and `TxRecord` in `lib/quick-l1/types.ts`), so the console can show progress for any blueprint.

## 1. Build

Assemble Standard JSON input:

- **Sources**: the blueprint's `contracts/*.sol`, the shared Teleporter interfaces, and every imported dependency file at the version pinned in `compiler.json`.
- **Settings**: `optimizer`, `evmVersion`, `viaIR` and `remappings` from `compiler.json`, or the blueprint's `compile` override. `outputSelection` must include `abi`, `evm.bytecode`, `evm.deployedBytecode` and `metadata`.

`lib/studio/compile.ts` does this: it resolves imports the way solc names them and reads dependencies from pinned, checksum-verified npm tarballs. It then compiles with `compileStandardJson` in `lib/verification/solc.ts`, the same solc-js runner the verifier uses. Keep the exact input: verification replays it.

Steps whose contract has an `artifact` use the precompiled JSON in the repo instead (ICTT, Teleporter, eERC). Link libraries with `lib/eerc/linkLibraries.ts` when the artifact has `linkReferences`.

## 2. Review

Run the audit (`lib/studio/audit`) and `review.md`. Deploy nothing while a critical or high finding is unacknowledged, or while any review item fails.

## 3. Simulate

Estimate gas for each deploy and call. When a call depends on an earlier step's output, simulate it after that step lands.

## 4. Sign and send

The platform holds no keys. The Studio deploy runner walks the steps in the builder's browser, and the builder's connected wallet signs each transaction, so `$ctx.deployer` and `$ctx.builder` are the same address.

- **Testnets** (`"testnet": true`): the runner advances step by step. The builder confirms each transaction in the wallet.
- **Production** (`"testnet": false`): only through a promotion. The runner shows each transaction in full and waits for an explicit confirmation in the Studio before asking the wallet.
- **Ownership**: a `transferOwnership(x)` step is skipped when `x` is the signer already. An `acceptOwnership()` step is skipped when the signer already owns the contract.
- **Evidence**: after each receipt, the browser reports `{ step, chain, txHash }` to the server. The server fetches the receipt from the chain's RPC and derives the deployed address and declared outputs itself, then records `{ step, chain, txHash, address, blockNumber }`. Outputs claimed by the browser are never trusted. Later `$out.<step>.<field>` references resolve from that server-side record.
- **Checks and reads**: `read` steps and `checks` run on the server against the chain's RPC.

## 5. Wait for cross-chain delivery

- **ICM**: after a send, poll `messageReceived(messageID)` on the destination TeleporterMessenger, or wait for the destination contract's event. The message page is `https://build.avax.network/explorer/<fuji|mainnet>/icm/<messageID>`.
- **CCIP**: track the message ID on `https://ccip.chain.link`. Delivery waits for source-chain finality by default, which can take many minutes on Ethereum-based testnets.

## 6. Verify

For every contract on an Avalanche chain, submit the Standard JSON from step 1 to the chain's `verifyApiUrl` (Etherscan-compatible), or to `https://build.avax.network/api/verify/sourcify`. Contracts on non-Avalanche chains are verified on that chain's own explorer instead.

## 7. Panel

For each entry in the blueprint's `panel`, show the listed read functions (callable without a wallet) and write functions (sent through the builder's wallet), using the ABI from the compile output. Link addresses as `<explorerUrl>/address/<address>` and transactions as `<explorerUrl>/tx/<hash>`.
