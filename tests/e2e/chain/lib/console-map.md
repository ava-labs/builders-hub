# Console map: tier 1 (PoA L1, Validator Manager on the Fuji C-Chain)

This map tells a test author, for each tier 1 step, which controls the test touches, what the page shows on success, which chain read proves the step, and which traps the code has. It also lists the UX problems found on the way, and their status.

Source: a code read of this worktree (base `7ddcb814a`) on 2026-10-04, updated on 2026-10-05 for the UX fixes of this branch (commit `4d69149e7` and the fix rounds after it). The names below are the names of the fixed pages. They hold on a server that runs this branch (a local server or a preview). On build.avax.network they hold only after the fixes deploy. File references name the component; line numbers change, so search the file for the text.

Notation:

- `role 'name'` means `screen.getByRole(role, 'name')` (e2e 0.17.0, `docs/reference/screen.mdx`). A string name matches the whole name. A `/regex/` name matches as written. A field of type number is a `spinbutton`, not a `textbox`. A `datetime-local` field has no role: find it with `screen.getByLabel`.
- `css: <selector>` means `browser.locator('<selector>')`. Use it only where the Console gives the control no accessible name. Put a comment in the test that names the missing label.
- `alert 'text'` means `pageAlert(screen, 'text')` (`chain/lib/console.ts`): `role 'alert'` filtered by its text (section 1.5).
- Chain helpers are in `chain/lib/chain.ts`: `waitForPTx`, `pSubnet`, `pIsL1`, `pL1Validator`, `pBalance`, `cHasCode`, `waitForCTx`, `managerValidator`, `managerNodeValidationId`, `managerTotalWeight`, `managerSubnetId`, `managerIsValidatorSetInitialized`, `waitForGlacierSubnet`, `glacierL1Validators`, `initialValidationId`, `ValidatorStatus`. They read past the public API's cache (`freshParams`).
- The signer records each send in `wallet.signer.sends` (`chain/lib/fixtures.ts`). Take every tx ID and contract address from that record and from the receipts. Where the page shows a full P-Chain tx ID (a Success box: a label, then a link named by the ID to `/explorer/fuji/p-chain/tx/<ID>`), check that the page shows the wallet's ID (`shownPChainTxId` in `chain/lib/validator-steps.ts`). The flow stores in localStorage are a cross-check only.
- The mock validators come from `chain/lib/mock-validator.ts` (section 3).
- The shared steps are in `chain/lib/create-l1.ts` (the create flow, sections 2.1 to 2.9) and `chain/lib/validator-steps.ts` (the Warp steps of the validator flows).

## 1. Facts that apply to every step

### 1.1 Open pages as a returning visitor

A first Console visit opens the dialog 'Welcome to Builder Console' 800 ms after mount (`components/console/onboarding-tour/welcome-modal.tsx`). The open dialog hides the page from the accessibility tree. The privacy banner also shows. `openAsReturningVisitor` in `chain/lib/console.ts` loads a small static file, writes both answers to localStorage (`lib/visitor.ts`), and then opens the page.

### 1.2 Wallet connection

The provider is an init script (`chain/wallet/provider.ts`, `web({ initScripts })`). It announces EIP-6963 rdns `app.core`, name `Core`. The site has no grant until the user connects (`chain/wallet/bridge.ts`), so wagmi never connects by itself. Each session connects once (`connectCore` in `chain/lib/fixtures.ts`):

1. `button 'Connect Wallet'` in the header. A tool page without a wallet also shows the gate `css: [data-console-tool-gate]` with `heading 'To use this tool you need:'` and `button 'Connect'` (`components/toolbox/components/CheckRequirements.tsx`). Both open the RainbowKit modal.
2. `dialog 'Connect a Wallet'`. In it, `button /^Core( Recent)?$/`. Fallback: `screen.getByTestId('rk-wallet-option-app.core')`.
3. Success: the header shows the P-Chain button: `button /P-Chain.*AVAX$/`. It renders only when the Console has the Core client and the P-Chain address.

Rules:

- Wait for the P-Chain button after each full load (`app.open`, `browser.reload`) before you touch anything. Before the wallet reconnects, `isTestnet` is false, so every flow store reads the mainnet copy of its data, and the C-Chain steps show the network gate.
- The Console treats the wallet as Core when the connector id is `app.core` or the injected provider has `isAvalanche` (`console-header/WalletSync.tsx`). Without that, the P-Chain buttons show a `platform-cli` command and the Warp steps show a `cast` command instead of a button.
- A `?subnetId=` query of a validator flow applies only after the wallet has reported its chain. Connect in the header first.

What the Console asks of the wallet (for the signer owner):

- Before each P-Chain tx: `wallet_getEthereumChain`. It must return `isTestnet: true`, or the Console switches the chain first (`hooks/useSubmitPChainTx.ts`). Then `avalanche_sendTransaction` through the SDK.
- Deploy Validator Manager: `wallet_addEthereumChain` and `wallet_switchEthereumChain` for 43113 before each deploy.
- Contract calls send `eth_sendTransaction` with a nonce that the page sets to the pending count, and the Warp steps add an `accessList` (`hooks/contracts/useContractActions.ts`).
- A test can make the wallet answer a request as a user who clicks Reject in Core: `signer.rejectNext(method)` answers the next request of the method with 4001 'User rejected the request.' before the wallet signs or sends anything. `signer.rejectNext(method, { times: Infinity })` answers each request of the method until `cancel()`: tier 1 uses it while it checks that a page sends nothing. The page then shows `alert 'You rejected the request in your wallet. To continue, click the button again and approve the request.'`. Every tool shows this text for an EVM tx and for a P-Chain tx (`WALLET_REJECTED` in `chain/lib/console.ts`). The sends audit fails on a rejection that is still armed.

### 1.3 Tool chrome and step flow

- Each tool renders `css: [data-console-tool="<tool title>"]` with `heading '<tool title>'` level 1 (`components/toolbox/components/Container.tsx`). The card has no role. The tool title can differ from the step title.
- A step flow renders `css: [data-console-flow]` (`components/console/step-flow.tsx`). 'Next' and 'Back' are links: `link 'Next'`, `link 'Back'`. The last step has `button 'Finish'`. The step pills are links in `navigation 'Steps'`; the active one has `aria-current="step"`.
- 'Next' is never gated. The questionnaire's 'Continue' is gated only on the first screen.
- `ChainGate` wraps each step. On a C-Chain step with the wallet on another chain it shows `heading 'Connect to Fuji C-Chain'` and `button 'Switch Network'`, and the step's controls are out of the accessibility tree until the switch. Tier 1 stays on 43113.

### 1.4 Button names change while busy

- The P-Chain tx buttons have the plain action name: `button 'Create Subnet'`, `button 'Convert to L1'` (the Core image has an empty alt).
- While busy, a toolbox `Button` shows its busy label in place of its name ('Processing...', 'Aggregating signatures...', 'Creating...', 'Confirming...') and has `aria-busy="true"`; idle, it has `aria-busy="false"`. A locator by the idle name stops matching while the button is busy (`busyThenIdle` and `clickAndSettle` in `chain/lib/console.ts` use this).
- So wait for the success signal or for the error box, not for "button enabled". The busy names are listed per step.

### 1.5 Errors and toasts

- An error `Alert` is `role 'alert'`; a warning or info `Alert` is `role 'status'` (`components/toolbox/components/Alert.tsx`). Next 16 adds its own `role="alert"` route announcer with no text, so an unfiltered `getByRole('alert')` can match two elements: filter by text (`pageAlert`). A few boxes still have no role (the C/P bridge error box): read them by text.
- A field error or a helper text under an Input is plain text tied to the field with `aria-describedby`; the field gets `aria-invalid="true"` on an error.
- After a P-Chain tx was issued but not confirmed, the error box says 'This transaction was issued and may still commit. Check it in the explorer before you send it again.' with `link 'View transaction in the explorer'`.
- The Console also shows sonner toasts. They go away by themselves. Do not use a toast as the success signal.
- If an error box contains '429' or 'Too Many Requests', stop the test. Do not click again.

### 1.6 State: what survives a reload

A serial group shares app state, so localStorage carries from one member to the next.

| localStorage key | Holds | Cleared by |
|---|---|---|
| `v4-create-l1-flow` | questionnaire answers, step index | 'Start deployment' sets new answers; closing the Finish modal clears it |
| `v4-create-chain-store-testnet` | `subnetId`, `chainID`, `chainName`, `managerAddress` (the proxy after Proxy Setup), `genesisData`, `evmChainId`, `convertToL1TxId`, and `proxyAdmin` (`{ address, evmChainId, subnetId }`) between the two proxy deploys (null after 'Deploy Proxy') | 'Start deployment' |
| `v4-toolbox-storage-43113` | `validatorMessagesLibAddress`, `validatorManagerAddress` | 'Start deployment'; 'Redeploy' |
| `v4-add-validator-store-testnet` | `subnetIdL1`, validator list, `evmTxHash`, `validatorBalance`, `blsProofOfPossession`, `pChainTxId` | `button 'Start over'` on step 1 |
| `v4-change-weight-store-testnet` | `subnetIdL1`, `nodeId`, `validationId`, `newWeight`, `evmTxHash`, `pChainTxId` | `button 'Start over'` on step 1 |
| `v4-remove-validator-store-testnet` | `subnetIdL1`, `nodeId`, `validationId`, `evmTxHash`, `pChainTxId` | `button 'Start over'` on step 1 |

React state is lost on any reload or remount: signatures, the 'Transaction Completed' state of initiate buttons.

### 1.7 Reload or remount

- Every tier 1 step survives a reload: the stores above keep the L1, the tx IDs and the ProxyAdmin. Tier 1 checks two reloads: between the two proxy deploys (2.4) and on the P-Chain Registration step (2.11).
- To mount a step fresh with no full load: `link 'Back'`, then `link 'Next'` (`remountStep`). The step's React state (a signature, an error) starts fresh. Do not click the initiate button on the way back: its 'Transaction Completed' state is gone and it is enabled again.
- To start a validator flow clean, click `button 'Start over'` on step 1 (it shows only when the store holds an L1). It clears the store and the `?subnetId=` query. Opening step 1 with a `?subnetId=` equal to the saved L1 no longer clears the flow.

### 1.8 Glacier: what each page reads, and the Node pre-wait

None of these reads retries, except the `useVMCAddress` re-read of a 'not an L1' result (below). Each runs on mount and again only when its inputs change. A read that ran before Glacier indexed the new state leaves the page without data until a remount. Rule: poll Glacier from Node first, then open or remount the page. Write the measured lag to the ledger.

| Page | Read | Effect of a miss | Node pre-wait |
|---|---|---|---|
| Convert to L1 | `SelectSubnet` → Data API `getSubnetById` once | 'Convert to L1' stays disabled | `waitForGlacierSubnet(subnetId)` |
| Every validator tool | `useVMCAddress` → Glacier subnet `isL1` and `l1ValidatorManagerDetails`, then the manager's blockchain | 'This is not an L1, or it has no Validator Manager. After a conversion, the Data API can take a few minutes to show the L1.' The hook reads the subnet again every 20 s, for up to 5 min after the first read. A 404 or 400 gets 'This L1 is not on Fuji. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.' A 5xx, a 429 or a network error gets 'Could not load the L1 from the Data API.'; the signing steps then show `alert 'Could not load the Validator Manager details: ...'` | `waitForGlacierSubnet(subnetId, { converted: true })` |
| Change weight, top-up, remove | `SelectValidationID` → `listL1Validators` with inactive validators, weight > 0 | the validator is not in the list; a failed read shows 'Could not load the validators of this L1: ...' under the field | `glacierL1Validators(subnetId, { includeInactive: true })` lists the validator |
| Disable | `ValidatorSelector` → `listL1Validators`, active only, weight > 0 | 'This L1 has no active validators.' | `glacierL1Validators(subnetId)` lists V0 |
| Subnet fields (`InputSubnetId`) | Glacier subnet on the wallet's network (L1 Node Setup: the network of the page's Network toggle, through the `isTestnet` prop), 500 ms after each change; the other network once after a 404 or 400. A read-only field (Explorer Setup) does not read Glacier | Under the field: 'This is not a valid Subnet ID. Check that the ID is complete and correct.' for any non-empty value that is not a Subnet ID in form; 'This L1 is not on Fuji. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.' for a 404 or 400 on both networks; 'This L1 is on Mainnet. Switch the wallet to Mainnet.' when only the other network has it. On L1 Node Setup, the texts name the toggle: 'This L1 is on Fuji. Set the Network to Fuji.' when only the other network has it; the not-found text when neither network has it; 'This L1 is not on Mainnet. If it is a Fuji L1, set the Network to Fuji.' when the read of the other network fails, and from the page's own read before the field's check ends. No field text for a 5xx, a 429 or a network error (the caller's text shows; Create Subnet shows 'Could not load the L1 from the Data API.'). Blocks nothing | none |

Initialize Validator Set needs no wait: it takes the conversion tx ID from the store when Glacier does not have it yet.

### 1.9 Warp deliveries and `deliverWithRetry`

`deliverWithRetry` (`chain/lib/warp.ts`) gets `landed`, `aggregate` and `deliver`. Each attempt needs a new signature. `chain/lib/validator-steps.ts` holds the validator-flow steps (`registerOnPChain`, `completeOnManager`, `aggregateThenSend`):

| Step | Fresh signature for an attempt | `deliver` waits for | `landed` |
|---|---|---|---|
| Initialize Validator Set | `button 'Aggregate Signatures'` (busy 'Aggregating...'), then 'Signature aggregated'. A retry clicks `button 'Re-aggregate signatures'`: it drops the signature and starts a new aggregation at once, so do not click 'Aggregate Signatures' after it | 'Validator set initialized' or the error box | `managerIsValidatorSetInitialized(proxy)` |
| Add validator, P-Chain Registration | one button aggregates and sends. After a failure the button comes back: click it again | the label 'RegisterL1ValidatorTx ID' with `link <tx ID>`; or an error box that starts 'P-Chain transaction failed:' (the submission) or 'Signature aggregation failed:' (the aggregation; a mapped text starts 'Signature aggregation reached' or 'Signature aggregation could not') | `pL1Validator(validationId) !== null` |
| Complete Registration, Complete Weight Change, Complete Removal | each click aggregates again. After a failure or a reverted tx the button is enabled again: click it again | 'Registration completed', 'Success! The validator weight has been updated successfully.', 'Validator removal completed', or the error box | status `Active`; `receivedNonce === sentNonce`; status `Completed` |
| Change weight and remove, P-Chain step | `button 'Aggregate Signatures'` (busy 'Aggregating signatures...'), then 'Signatures aggregated'. After a failed submission the step keeps its signature and shows `button 'Re-aggregate signatures'`; the test remounts the step for a retry | 'P-Chain tx confirmed:' or 'P-Chain submission failed:' | `pL1Validator` weight 12, or weight 0 after removal |

Timing: one click can take minutes. The page itself retries a below-quorum or transient aggregation up to 4 times, and each attempt can last 60 s (`utils/aggregationRetry.ts`). Give `deliver` a 5 min wait, then let `deliverWithRetry` wait its 15 s.

Signing subnet: on a C-Chain manager the Primary Network signs. The pages take the signing subnet from the manager details (`useVMCAddress`). While the details load, each Warp button of the validator flows is disabled (same idle name) and the step shows 'Loading the Validator Manager details...'. So wait for the button to be enabled before the click (`expect(button).toBeEnabled()`). The badge 'PoA · EOA' in the step header (CSS shows it in upper case, the text is mixed case) shows the owner type.

### 1.10 Requests that the page makes by itself

Count these when you set your own poll rate. They are the app's requests; the Node code still uses public endpoints only, under 2 per second.

- After each P-Chain tx, `waitForPChainConfirmation` polls `platform.getTxStatus` every 2 s for up to 60 s (`utils/pchainConfirmation.ts`). After 60 s the page reports a timeout and keeps the issued tx ID, but the tx can still commit. Decide by the chain.
- The top-up tool reads the P-Chain balance every 10 s.
- A failed contract simulation on Fuji makes the page call the site's own `/api/debug-rpc`.
- Each Warp click: one Glacier aggregation request per page-side attempt (up to 4).
- Remove expired registration: one `eth_getLogs` per 2,000 blocks from 'From Block' to the head.

### 1.11 The P-Chain balance warning

The P-Chain steps of Add validator and Remove read the real P-Chain balance. They show `status 'Insufficient P-Chain balance for transaction fees. You need at least 0.1 AVAX. ...'` only below 0.1 AVAX (`add-validator/steps/PChainRegistrationStep.tsx`; `remove-validator/steps/PChainRemovalStep.tsx`). The register step also shows 'Exceeds P-Chain balance (X AVAX)' when the validator balance is more than the P-Chain balance. Tier 1 checks that neither shows for the funded key.

### 1.12 Before each send, and where to resume

Before each send, read the chain (and the ledger). If the effect is already there, do not click. This happens when the page reported a failure (most often the 60 s P-Chain confirmation timeout) but the tx landed. Then carry on with the ID from the signer's record:

| Step | "Already landed" check | Where the page takes the ID |
|---|---|---|
| Create Subnet | `pSubnet(subnetId)` exists | `textbox 'Already have a Subnet ID?'` |
| Deploy Validator Manager | `cHasCode(address)` for each contract | per card, the 'Already deployed? Enter the address' toggle and its address field |
| Proxy Setup | `cHasCode(proxy)` and the EIP-1967 slots | the page keeps a ProxyAdmin that it deployed (store `proxyAdmin`); after a reload 'Deploy Proxy' is the only deploy button |
| Initialize Validator Manager | `managerSubnetId(proxy)` is the subnet | none needed |
| Create Chain | `waitForPTx(chainId)` | none. Convert does not need the chain ID for a C-Chain manager |
| Convert to L1 | `pIsL1(subnetId)` | Initialize Validator Set: `textbox 'Conversion Tx ID (P-Chain)'` |
| Initialize Validator Set | `managerIsValidatorSetInitialized(proxy)` | none needed |
| Add validator, initiate | `managerNodeValidationId(proxy, v1.nodeID)` is not zero | P-Chain step: `textbox 'initiateValidatorRegistration Transaction Hash'` |
| Add validator, P-Chain | `pL1Validator(validationId)` exists | Complete step: `textbox 'P-Chain Transaction ID'` |
| Change weight, initiate | `managerValidator(...).weight === 12n` | P-Chain step: `textbox 'initiateValidatorWeightUpdate Transaction Hash'` |
| Change weight, P-Chain | `pL1Validator(...).weight === 12n` | Complete step: `textbox 'P-Chain Transaction ID'` |
| Remove, initiate | status `PendingRemoved` | the page shows a resend card instead (2.14) |
| Remove, P-Chain | `pL1Validator(v1)` weight 0 | Complete step: `textbox 'P-Chain SetL1ValidatorWeightTx ID'` |
| Top-up | V0's balance grew | none |
| Disable | `pL1Validator(v0).balance === 0n` | none |

### 1.13 The public API lags itself

`api.avax-test.network` is load-balanced, and its nodes accept a block at different times. On 2026-10-04 `platform.getTxStatus` said Committed for a ConvertSubnetToL1Tx, and the next `platform.getSubnet` came from a node that still showed no conversion. A Node check after a tx must poll until a node shows the result (`chainShows` in `chain/lib/chain.ts`, 90 s). The API also caches `platform.getCurrentValidators`, `platform.getSubnet` and `platform.getTx` by their params for about 3 min; the Node reads add a param that the node ignores (`freshParams`). The Console's own reads go to the same endpoints and get the cached answer.

## 2. Steps

The create flow for PoA, manager on the C-Chain, Docker hosting has 8 steps (`components/toolbox/console/create-l1/generateSteps.ts`): `/console/create-l1/create-subnet`, `deploy-validator-manager`, `proxy-setup`, `initialize-manager`, `create-chain`, `docker-setup`, `convert-to-l1`, `init-validator-set`. `chain/lib/create-l1.ts` runs them for tier 1 and for the PoS file; tier 1 also runs the page checks of `uxChecks`.

A step URL with no stored answers redirects to `/console/create-l1`. Run the questionnaire first in the same session. Move between steps with `link 'Next'`.

### 2.0 C/P bridge

- Route: `/console/primary-network/c-p-bridge`. The tool gates itself on the Fuji C-Chain. `chain/bridge-cp.e2e.ts` covers it (tag `bridge`).
- Controls:
  - Direction: text 'From C-Chain' or 'From P-Chain'. `button 'Swap chains'` swaps them.
  - `spinbutton 'Amount'` (`aria-label`).
  - `button 'MAX'`.
  - `button /^Export .* AVAX from /`. The import runs by itself after the export.
- Success: `button 'Start New Transfer'`. The history lists each tx on its own chain: the P-Chain export and import with the badge 'P-Chain', the C-Chain export and import with the badge 'C-Chain' (store type `cchain-atomic`).
- Chain check: `pBalance(P address)` and `cBalance(C address)` change by the amount and the fees (`chain/lib/bridge-cp.ts`); shared memory holds none of the key's AVAX after the round trip, except the dust that the first test left (`chain/lib/atomic.ts`).
- Gotcha: a pending import from an earlier run shows 'Pending import from a previous transfer' and `button /^Import .* AVAX to /`. Click it before a new export. The error box has no role: read it by text.
- Anyone can export a UTXO to the key's address. The page imports only the key's own unlocked AVAX, and gives the SDK exactly the UTXOs that it selects (`selectImport` and `toSdkUtxos` in `components/toolbox/utils/sharedMemoryImport.ts`). A UTXO enters only when it holds more than the fee of its own input (`inputGas` times the price that the page reads first). One import takes the largest of these first, as many as fit in its gas limit (`importGasLimit`): 100,000 gas on the C-Chain (coreth's gas limit for an atomic tx), and half the P-Chain's maxCapacity on the P-Chain (`maxPImportGas`; the SDK refuses a P-Chain import above the current capacity). So a UTXO that the key cannot import alone (locked, another asset, more owners) has no effect on the import or its fee, and a dust flood cannot raise the fee above the export. When the selection cannot pay its fee (dust), the page imports nothing on that side. The page shows one line with the count of the UTXOs that it leaves, and keeps Export. It reads each side page by page (`readSharedMemory`, at most 10 pages of 1,024 UTXOs), and shows 'Shared memory holds more UTXOs than this page reads.' when a side holds more. The test reads and sorts shared memory with the same rules (`atomicUtxos` and `importSelection` in `chain/lib/atomic.ts`, at the page's prices from `pageImportRule` in `chain/lib/bridge-cp.ts`), records the dust and does not wait for it (`importProblems`, `LeftUtxos`), and checks that each import it clicks spends exactly the page's selection (`importPending`).

### 2.1 Questionnaire

- Route: `/console/create-l1`. Gate: wallet connected.
- Each option card is a button. Its name is the title, the description and, on some cards, 'Recommended', run together. Match the start of the name. The picked card has `aria-pressed="true"`, the others `"false"`.
- Controls, in order (all headings are h2):
  1. `heading 'Choose a setup'`. `button /^Advanced setup/`, then `button 'Continue'`. Here 'Continue' stays disabled until a card is picked.
  2. `heading 'Validator management'`. `button /^Proof of Authority/`, then 'Continue'. Pick it before the next question: picking a validator type resets the manager location.
  3. `heading 'Validator Manager location'`. `button /^On C-Chain/`, then 'Continue'.
  4. `heading 'Interoperability'` (shown only for the C-Chain). `button /^Enable cross-chain messaging/`, then 'Continue'.
  5. `heading 'Contract ownership'` (PoA on the C-Chain only). `button /^Single wallet/`, then 'Continue'.
  6. `heading 'Infrastructure'`. `button /^Docker/`, then 'Continue'.
  7. `heading 'Review your setup'`. The list shows 'Create Subnet', 'Deploy Validator Manager', 'Proxy Setup', 'Initialize Validator Manager', 'Create Chain', 'Docker Node Setup', 'Convert to L1', 'Initialize Validator Set'. `button 'Start deployment'`.
- Success: the URL becomes `/console/create-l1/create-subnet`. 'Start deployment' cleared the create stores.
- Gotchas:
  - A stored flow shows the banner 'Resume your previous flow' on screen 2. Do not click 'Resume'.
  - The banner 'We recommend starting on Fuji testnet' shows when the wallet is on mainnet. Fail the test if it shows after the P-Chain header button is there.

### 2.2 Create Subnet (P-Chain)

- Route: `/console/create-l1/create-subnet`. Tool title 'Create Subnet'.
- Control: `button 'Create Subnet'` (`layer-1/create/CreateSubnet.tsx`). Busy names 'Creating...', then 'Confirming...'.
- Success: the label 'Subnet ID (CreateSubnetTx)' and `link <subnet ID>` to `/explorer/fuji/p-chain/tx/<subnet ID>`. The button is then disabled.
- Error: 'Subnet ID (CreateSubnetTx, not confirmed)' with the issued ID, and an error box with the issued-tx text (section 1.5).
- Chain check: the subnet ID is the CreateSubnetTx ID from the signer's record; the page's link shows the same ID. `pSubnet(subnetId)` shows the wallet's P address as the only control key, threshold 1.

### 2.3 Deploy Validator Manager (C-Chain, 2 deploys)

- Route: `/console/create-l1/deploy-validator-manager`. Tool title 'Deploy Validator Contracts'.
- Controls:
  1. `button 'Deploy Library'`.
  2. `button 'Deploy Contract'`. Disabled until the library has an address.
- Success: each card shows the full address in a `code` element, and `button 'Redeploy library'` or `button 'Redeploy manager'`.
- Error: `alert` under the cards.
- Chain check: take both addresses from the receipts (`contractAddress`) in send order. `cHasCode` for each.
- Gotchas:
  - Each deploy first calls `wallet_addEthereumChain` and `wallet_switchEthereumChain` for 43113.
  - 'Redeploy' clears the stored addresses. Do not click it.

### 2.4 Proxy Setup (C-Chain, 2 deploys)

- Route: `/console/create-l1/proxy-setup`. Tool title 'Proxy Setup'.
- Controls:
  1. On the C-Chain the section 'Deploy New Proxy' opens by itself once the wallet chain is known. `textbox 'Proxy Address'` starts empty on the C-Chain.
  2. ProxyAdmin: `button 'Deploy ProxyAdmin'`. It is disabled while the page checks a ProxyAdmin that it saved earlier.
  3. Proxy: `button 'Deploy Proxy'`. Disabled until the ProxyAdmin has an address. `textbox 'Implementation address'` holds the ValidatorManager address. A string name is exact, so 'Deploy Proxy' does not match 'Deploy ProxyAdmin'.
- After the ProxyAdmin deploy: the ProxyAdmin column shows a check and the address cut to 10 characters, and its button is gone. The store keeps `proxyAdmin` (`{ address, evmChainId: 43113, subnetId }`). A reload shows the same, and 'Deploy Proxy' is the only deploy button (tier 1 checks this).
- Success: the upgrade card shows 'Proxy is up to date'. The store's `managerAddress` is the proxy, and `proxyAdmin` is null.
- Errors: `alert` texts that start 'This page does not use the ProxyAdmin that it deployed earlier' (the saved ProxyAdmin has another owner, no code, or is not a ProxyAdmin) or 'Could not check the ProxyAdmin that this page deployed earlier'.
- Chain check: `cHasCode(proxyAdmin)`, `cHasCode(proxy)`. The EIP-1967 implementation slot of the proxy holds the ValidatorManager address, and the admin slot holds the ProxyAdmin.

### 2.5 Initialize Validator Manager (C-Chain)

- Route: `/console/create-l1/initialize-manager`. Tool title 'Initialize Validator Manager'.
- Fields: `textbox 'Subnet ID'` (from the store), `textbox 'ValidatorManager Address'`, `textbox 'Admin Address'`, `spinbutton 'Churn Period (sec)'`, `spinbutton 'Max Churn %'`, `button 'Check status'`. Defaults: admin = the wallet's C address, churn period 0 s, maximum churn 20 %.
- Wait for: 'Ready to initialize'.
- Control: `button 'Initialize Contract'`. Disabled until 'Ready to initialize'.
- Success: the label 'Contract initialized. Transaction hash:' and the tx hash in a `code` element (a C-Chain hash is not a link). A later visit shows 'Contract already initialized'.
- Chain check: `managerSubnetId(proxy)` equals the new subnet ID. `owner()` is the wallet's C address.
- Gotcha: Initialize binds the manager to the subnet for good. Check `textbox 'Subnet ID'` before you click.

### 2.6 Create Chain (P-Chain)

- Route: `/console/create-l1/create-chain`. Tool title 'Create Chain'.
- The genesis builds by itself from the defaults: Subnet-EVM, a random EVM chain ID, the wallet as the first allocation and the PoA owner, Warp and the ICM messenger on. `textbox 'Chain Name'` holds a random name.
- Control: `button 'Create Chain'`. It shows only after the genesis is valid. Busy names 'Creating Chain...', then 'Confirming...'.
- Success: the label `Chain "<name>" created (CreateChainTx ID)` and `link <chain ID>`. The button is then disabled.
- Chain check: the chain ID is the CreateChainTx ID from the signer's record. `platform.getTx` shows the run's subnet and the subnet-evm VM ID.

### 2.7 Docker Node Setup (skipped)

- Route: `/console/create-l1/docker-setup`. Tool title 'L1 Node Setup with Docker'.
- Control: `link 'Next'`. Nothing gates it.

### 2.8 Convert to L1 (P-Chain) with mock validator V0

- Route: `/console/create-l1/convert-to-l1`. Tool title 'Convert Subnet to L1'.
- Before you open it: `waitForGlacierSubnet(subnetId)`. The page reads the subnet once (section 1.8).
- Wait for:
  - `textbox 'Subnet'` holds the subnet ID.
  - The helper 'A Validator Manager exists at this address on the C-Chain, so the C-Chain is selected.' Then `textbox 'Manager Chain ID'` holds the Fuji C-Chain ID and `textbox 'Manager Contract Address'` holds the proxy.
  - 'Checking the manager address on the C-Chain...' is gone.
- Controls (`addValidatorFromJson` in `chain/lib/create-l1.ts`):
  1. `tab 'API Response'`.
  2. `textbox /^Paste the JSON response/`, `fill(nodeCredentialsJson(v0))`. The Manual tab has `textbox 'Node ID'` (exact), `textbox 'BLS Public Key'`, `textbox 'BLS Proof of Possession'`.
  3. `button 'Add Validator'`. The validator card opens: its header is `button <NodeID>` with `aria-expanded="true"`. `button 'Remove validator <NodeID>'` removes it.
  4. `spinbutton 'Consensus Weight'`: keep the default 100.
  5. `spinbutton 'Validator Balance (P-Chain AVAX)'`: `fill('0.02')`. Use `fill`, not typed keys: the field converts each value to nAVAX at once.
  6. `button 'Convert to L1'`. Busy names 'Converting...', then 'Waiting for P-Chain confirmation...'.
- Success: the label 'ConvertSubnetToL1Tx ID' and `link <tx ID>`, and `button 'Converted to L1'`, disabled.
- Error: `status` with a list of problems above the button, or `alert` under it.
- Chain check: `pIsL1(subnetId)` is true; `pSubnet` shows manager chain = the C-Chain and manager address = the proxy. `pL1Validator(initialValidationId(subnetId, 0))` shows V0's NodeID, weight 100, a balance near 0.02 AVAX, and the wallet's P address as remaining-balance owner and deactivation owner.
- Gotcha: the default validator balance is 0.1 AVAX. Change it. The conversion is permanent.

### 2.9 Initialize Validator Set (C-Chain; the Primary Network signs)

- Route: `/console/create-l1/init-validator-set`. Tool title 'Initialize Validator Set'.
- The page fills `textbox 'L1 Subnet ID'` from the store, and `textbox 'Conversion Tx ID (P-Chain)'` from Glacier or, before Glacier has it, from the store.
- Controls:
  1. `button 'Aggregate Signatures'`. Needs a conversion tx ID. Busy name 'Aggregating...'.
  2. Wait for 'Signature aggregated'. The text 'subnet: <signing subnet>' next to it starts with the Primary Network ID.
  3. `button 'Initialize Validator Set'`.
- Success: 'Validator set initialized'.
- Error: `alert` under the second card. Mapped texts come from `parseAggregationError` and `parseInitValidatorSetError`.
- Chain check: `managerIsValidatorSetInitialized(proxy)` is true. `managerTotalWeight(proxy)` is 100. `managerNodeValidationId(proxy, v0.nodeID)` equals `initialValidationId(subnetId, 0)` as hex. `managerValidator(...).status` is `ValidatorStatus.Active`.
- Page check (tier 1): a blockchain ID in `textbox 'L1 Subnet ID'` gets 'This L1 is not on Fuji. A new L1 can take a minute to appear. Check that the ID is a Subnet ID, not a blockchain ID.' and no wallet request. The subnet ID again brings the conversion tx ID back.
- Gotchas:
  - Retry: `button 'Re-aggregate signatures'` (section 1.9).
  - Do not click 'Finish' unless the test covers the end modal. Closing the modal clears `v4-create-l1-flow`.

### 2.10 Initiate V2 only (carry-over seed for remove-expired, M2; not in the test yet)

- Route: `/console/add-validator/select-subnet?subnetId=<subnetId>`.
- Controls: as 2.11 steps 1 and 2, with V2 and weight 1. Stop at 'Transaction Completed'. Do not open the P-Chain step.
- Chain check: `managerValidator(proxy, validationId)` has status `PendingAdded`. Write the block number and the `registrationExpiry` of the `InitiatedValidatorRegistration` event to the ledger.
- Gotcha: the add-validator store keeps V2 and the L1. Click `button 'Start over'` on step 1 before the 2.11 flow.

### 2.11 Add validator V1 (C-Chain, P-Chain, C-Chain)

Route: `/console/add-validator/select-subnet?subnetId=<subnetId>`. Steps: `select-subnet`, `initiate-registration`, `pchain-registration`, `complete-registration`, `verify-validator-set` (optional). No tool gate: connect in the header first.

Before you open it: `waitForGlacierSubnet(subnetId, { converted: true })`.

1. Select L1
   - Wait for the badge 'PoA · EOA' next to `heading 'Select L1'`, and for `button '11111111111111111111111111111111LpoYY'` (the signing subnet in 'Validator Manager Details').
   - `link 'Next'`.
2. Initiate Validator Registration (C-Chain)
   - `addValidatorFromJson(screen, v1)`, as 2.8 steps 1 to 3.
   - `spinbutton 'Consensus Weight'`, `fill('10')`. The page refuses 20 % or more of the L1's weight: under the field "This validator's weight is 25.00% of the current total L1 weight. It must be less than 20%. Enter 19 or less." (for 25 of 100; the number is the largest weight under 20%), and on the click `alert "The new validator's proposed weight (25) represents 25.00% of the current total L1 weight (100). This must be less than 20%."` with no wallet request (tier 1 checks this before the real weight).
   - `spinbutton 'Validator Balance (P-Chain AVAX)'`, `fill('0.02')`.
   - Fill the card before you initiate: each card edit clears the stored tx hash.
   - `button 'Initiate Validator Registration'`. Busy name 'Processing...'.
   - Success: the button name becomes 'Transaction Completed'.
   - Chain check: `managerNodeValidationId(proxy, v1.nodeID)` is not zero. `managerValidator(...)`: status `PendingAdded`, weight 10. The validation ID is topic 1 of the manager's log in the receipt.
3. P-Chain Registration
   - A reload here keeps the L1 and the initiate tx (tier 1 checks this: the store's `subnetIdL1` is the L1, and 'No transaction hash from the initiation step' does not show).
   - Wait for the badge 'PoA · EOA', 'Initial Balance:' and the text '0.02 AVAX'. They show when the page has read the Warp message from the initiate receipt.
   - `button 'Sign & Submit to P-Chain'`: enabled once the manager details have loaded. It aggregates, sends the RegisterL1ValidatorTx and waits for it. Busy name 'Processing...'. 'Signatures aggregated. Approve RegisterL1ValidatorTx in Core. ...' shows while it waits; it is not the success signal.
   - Success: the exact label 'RegisterL1ValidatorTx ID' and `link <tx ID>`. After a failed confirmation the label is 'RegisterL1ValidatorTx ID (not confirmed)' next to the error box.
   - Chain check: the RegisterL1ValidatorTx from the signer's record gives 'Committed'; the page's link and the store's `pChainTxId` show the same ID. `pL1Validator(validationId)` shows weight 10 and a balance near 0.02 AVAX.
4. Complete Registration (C-Chain)
   - `textbox 'P-Chain Transaction ID'` is filled from the store.
   - `button 'Complete Validator Registration'`. Busy name 'Processing...'.
   - Success: 'Registration completed' and 'Success! Your validator is now registered and active on the L1.'
   - Chain check: `managerValidator(...).status` is `Active`. `managerTotalWeight` grew by 10.

### 2.12 Change weight of V1 (10 to 12)

Route: `/console/permissioned-l1s/change-validator-weight/select-subnet?subnetId=<subnetId>`. Steps: `select-subnet`, `initiate-weight-change`, `pchain-weight-update`, `complete-weight-change`, `verify-validator-set` (optional). The steps show no type badge.

Before you open it: `glacierL1Validators(subnetId, { includeInactive: true })` lists V1.

1. Select L1: the query fills `textbox 'Subnet ID'`. Wait for `button '11111111111111111111111111111111LpoYY'` (the signing subnet). `link 'Next'`.
2. Initiate Weight Change
   - Under `textbox 'Validation ID'` each validator of the L1 is a button named by its NodeID and its weight, for example 'NodeID-... Weight: 10 | 0.02 AVAX'. Click `button new RegExp('^' + v1.nodeID)`; the picked one has `aria-pressed="true"`. A Validation ID typed before the list loads also works once the list loads.
   - `textbox 'New Weight'`, `fill('12')`.
   - `button 'Initiate Change Weight'`. Busy name 'Processing...'.
   - Success: 'Transaction Completed'.
   - Chain check: `managerValidator(...)`: weight 12, `sentNonce` > `receivedNonce`.
3. P-Chain Weight Update
   - `button 'Aggregate Signatures'` (enabled once the manager details have loaded; busy 'Aggregating signatures...'). Wait for 'Signatures aggregated'. Then `button 'Submit to P-Chain'`; busy name 'Submitting to P-Chain…'.
   - Success: 'P-Chain tx confirmed:' with the tx ID.
   - Chain check: `pL1Validator(validationId)` shows weight 12.
4. Complete Weight Change
   - `button 'Complete Weight Change'`: enabled once the manager details have loaded. Busy name 'Processing...'.
   - Success: 'Success! The validator weight has been updated successfully.'
   - Chain check: `managerValidator(...)`: `receivedNonce` equals `sentNonce`, weight 12.

### 2.13 Balance top-up of V0 (+0.01 AVAX)

- Route: `/console/layer-1/l1-validator-balance`. Tool title 'Validator Balance Increase'.
- Before you open it: `glacierL1Validators(subnetId, { includeInactive: true })` lists V0.
- Controls:
  1. `textbox 'Subnet ID'`, `fill(subnetId)`.
  2. Validation ID (CB58 here): `button new RegExp('^' + v0.nodeID)`; the picked one has `aria-pressed="true"`.
  3. `spinbutton 'Amount'`, `fill('0.01')`.
  4. `button 'Increase Balance'`. Disabled while the amount is above the P-Chain balance. Busy name 'Increasing Balance...'.
- Errors show once, in an `alert` box ('Invalid amount provided.', 'Amount exceeds available P-Chain balance.', the parsed P-Chain error). A user rejection shows only the `alert` with the text of `WALLET_REJECTED` (section 1.2). Tier 1 checks this with `signer.rejectNext`, then clicks again.
- Success: `heading 'Balance Increased Successfully'` (h3), 'Added 0.01 AVAX to validator balance', `button 'Copy transaction ID'` and `link 'View transaction in the explorer'` to `/explorer/fuji/p-chain/tx/<tx ID>`.
- Chain check: `pL1Validator(v0ValidationId).balance` grew by about 0.01 AVAX. The balance falls by 512 nAVAX each second, so compare with a margin.

### 2.14 Remove validator V1

Route: `/console/remove-validator/select-subnet?subnetId=<subnetId>`. For PoA the flow drops 'Claim Delegation Fees' once the type is known. Steps: `select-subnet`, `initiate-removal`, `pchain-removal`, `complete-removal`, `verify-validator-set` (optional).

1. Select L1: wait for the badge 'PoA · EOA'. `link 'Next'`.
2. Initiate Removal
   - Validation ID (HEX): `button new RegExp('^' + v1.nodeID)`; the picked one has `aria-pressed="true"`.
   - `button 'Initiate Validator Removal'`. Busy name 'Processing...'.
   - Success: 'Transaction Completed'.
   - Chain check: `managerValidator(...).status` is `PendingRemoved`.
3. P-Chain Weight Update
   - Wait for the badge 'PoA · EOA' and for `button 'Aggregate Signatures'` to be enabled. The balance warning does not show (section 1.11).
   - `button 'Aggregate Signatures'`, then `button 'Submit to P-Chain'` (shared component, 2.12 step 3). `textbox 'Initiate Removal Transaction Hash'` holds the initiate tx.
   - Success: 'P-Chain tx confirmed:'.
   - Chain check: `pL1Validator(v1ValidationId)` shows weight 0. The remaining balance goes back to the wallet's P address.
4. Complete Removal
   - `textbox 'P-Chain SetL1ValidatorWeightTx ID'` is filled from the store.
   - `button 'Sign & Complete Validator Removal'`. Busy name 'Processing...'.
   - Success: 'Validator removal completed'.
   - Chain check: `managerValidator(...).status` is `Completed`. `managerTotalWeight` fell by 12.

Gotcha: if a removal went out earlier and the P-Chain step failed, the initiate step shows a resend card with `button 'Resend Removal Message'`, because the validator is `PendingRemoved` with `sentNonce` > `receivedNonce`. Click it, then 'Next'.

### 2.15 Remove expired registration (carry-over, M2; not in the test yet)

- Route: `/console/permissioned-l1s/remove-expired-validator-registration`. Tool title 'Remove Expired Validator Registration'.
- Controls: the subnet field (it starts with the create store's subnet, so fill the old L1's subnet), then `textbox /^From Block/` (the name is 'From Block (defaults to last 100k blocks)'), `fill(<ledger block number>)`. Then `button 'Search for Expired Registrations'`. Then, on the card that shows V2's validation ID (hex), `button 'Remove'`. Scope the card with `filter({ hasText: v2ValidationIdHex })`.
- Success: 'Removal Successful' on that card.
- Chain check: `managerValidator(v2ValidationId).status` is `Invalidated`.
- Gotcha: fill 'From Block' with the ledger's block number: a blank field scans the last 100k blocks, one `eth_getLogs` per 2,000 blocks.

### 2.16 Disable V0 (teardown, P-Chain)

- Route: `/console/permissioned-l1s/disable-validator`. Tool title 'Disable L1 Validator'.
- Before you open it: `glacierL1Validators(subnetId)` lists V0 as active.
- Controls:
  1. `textbox 'Subnet ID'`, `fill(subnetId)`. Use `fill`: each change of the field loads the list again.
  2. The list (`group 'Select Validator to Disable'`, `textbox 'Search validators'`) loads by itself. `button 'Refresh'` loads it again. Pick V0: `button new RegExp('^' + v0.nodeID)`.
  3. Wait for 'Your wallet is authorized to disable this validator.'
  4. `checkbox /^I understand this disables/`, `check()`.
  5. `button 'Disable Validator'`. Busy name 'Disabling Validator...'.
- Success: `heading 'Validator Disabled'` (h4) and `link 'View transaction in the explorer'` to `/explorer/fuji/p-chain/tx/<tx ID>`.
- Chain check: `pL1Validator(v0ValidationId).balance` is 0. The wallet's P balance grew by the refund.
- Gotchas:
  - The page computes `disableAuth` from Glacier's deactivation owner list. The SDK does not pass the owners to the wallet, so the signer reads them from `platform.getL1Validator`.
  - The list hides validators with weight 0 and inactive validators.

## 3. Mock validators

`chain/lib/mock-validator.ts`:

- `createMockValidator({ label, seed? })` returns `{ label, nodeID, nodeIDHex, publicKey, proofOfPossession }`. The BLS secret key does not leave the function.
- `nodeCredentialsJson(v)` returns the `info.getNodeID` response for the JSON tab: `{"jsonrpc":"2.0","result":{"nodeID":...,"nodePOP":{"publicKey":...,"proofOfPossession":...}},"id":1}`.
- `verifyMockValidator(v)` throws when the Console form or the P-Chain would refuse the validator.
- `assertPopSchemeMatchesAvalanchego()` runs once per process (in `createMockValidator`). It signs with avalanchego's local staker key (`staking/local/signer1.key`, a public test fixture) and compares the bytes with the proof in avalanchego's `genesis/genesis_local.json`, through @noble/curves and through avalanchejs.
- `PROOF_OF_POSSESSION_DST`, `encodeNodeID(bytes)`.
- CLI from `tests/e2e`: `node chain/lib/mock-validator.ts [seed]` checks the scheme and prints one validator's JSON (public values only).

What the P-Chain checks (avalanchego origin/master `5bf881e069`): weight not 0, a 20-byte NodeID that is not empty, a valid proof of possession (`vms/platformvm/platform/convert_subnet_to_l1_tx.go:109-131`). Any balance above 0 makes the validator active; there is no minimum (`vms/platformvm/txs/executor/standard_tx_executor.go:801-811`). The proof signs the 48-byte compressed public key with the ciphersuite `BLS_POP_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_` (`vms/platformvm/signer/proof_of_possession.go`; `utils/crypto/bls/public.go`, `signature.go`, `ciphersuite.go`).

Plan for one night: V0 (convert, weight 100, 0.02 AVAX), V1 (add, weight 10, 0.02 AVAX), V2 (initiate only, weight 1). Pass `seed: '<run id> V0'` and so on to make a run reproducible from its ledger.

## 4. UX findings

Each item names the file and line in this worktree at base `7ddcb814a` (paths under `components/toolbox` unless the path says otherwise). Severity: A = blocks or misleads a user, B = accessibility, C = text or consistency.

Status on 2026-10-05: the UX fix rounds of this branch address findings 1 to 32, 34, 35, 37 and 38; sections 1 and 2 give the fixed names and behavior. Finding 4 is partly fixed: `useVMCAddress` reads a 'not an L1' result again every 20 s for 5 min, and the 404 text says that a new L1 can take a minute to appear. The other pages still read Glacier once. Findings 33 and 36 are open. The items below keep their first text as the record of what the live runs found. The findings F-01 to F-29 of the Console bug hunt (`tests/e2e/explore/console/`) are in the last table.

### A: behavior

1. A frozen balance gives false warnings. `stores/walletStore.ts:231-241` defines `pChainBalance`, `l1Balance` and `cChainBalance` as getters in zustand state. The first `set` copies them as plain values, so they keep their initial values. Results: 'Insufficient P-Chain balance' always shows on the P-Chain steps of Add validator and Remove (`console/add-validator/steps/PChainRegistrationStep.tsx:19-23, 61-74`; `console/remove-validator/steps/PChainRemovalStep.tsx:28-31, 51-64`). The low-balance faucet hint of the questionnaire never shows (`console/create-l1/CreateL1Questionnaire.tsx:207, 310-311`). The PoS stake balance check never runs (`console/add-validator/steps/InitiateRegistrationStep.tsx:61, 80`). Fix: read `s.balances.pChain`, as `BalanceTopup.tsx:83` does.
2. Create buttons stay enabled after success. `console/layer-1/create/CreateSubnet.tsx:100-111` and `console/layer-1/create/CreateChain.tsx:313-325` disable the button only after an unconfirmed failure. A second click creates a second subnet or chain. Create Chain also puts a new random name in the field after success (`CreateChain.tsx:150`), which invites a second click.
3. Convert to L1 shows no result. `console/layer-1/create/ConvertSubnetToL1.tsx:153-193` stores the tx ID but renders no success message and no tx ID, and the button goes back to 'Convert to L1', enabled (`:298-308`). The user cannot tell that the permanent conversion happened.
4. No retry after a Glacier miss. `components/SelectSubnet.tsx:33-81`, `hooks/useVMCAddress.ts:63-184`, `components/SelectValidationID.tsx:84-127` and `components/InputSubnetId.tsx:55-91` read Glacier once per input. Right after a new subnet, conversion or validator, Glacier often lags. The page then shows 'Subnet ID not found or invalid', an empty list or a disabled button until a remount, with no hint to wait.
5. No fresh signature on Initialize Validator Set. After one aggregation the 'Aggregate Signatures' button is gone, and each 'Initialize Validator Set' click reuses the stored signature (`console/permissioned-l1s/validator-manager-setup/InitValidatorSet.tsx:322, 466-496`). A stale signature can only be replaced with a reload. Fix: a 'Re-aggregate signatures' link, as `console/shared/SubmitPChainTxWeightUpdate.tsx:388-397` has.
6. The register step misreports progress and has no retry. 'Signatures aggregated' shows before the RegisterL1ValidatorTx goes out, the step shows nothing while the tx is pending, and on success it shows no P-Chain tx ID (`console/permissioned-l1s/add-validator/SubmitPChainTxRegisterL1Validator.tsx:148, 155-169, 294-309`). After a failed tx the submit button is gone (`:294-332`). Compare 'P-Chain tx confirmed:' on the weight step (`SubmitPChainTxWeightUpdate.tsx:424-433`).
7. A reverted completion disables its button. `console/shared/CompletePChainRegistration.tsx:306-311, 357-363` and `console/shared/CompletePChainWeightUpdate.tsx:281-286, 338-345` keep the hash of the reverted tx, so the button stays disabled until a remount.
8. Errors are hidden on the top-up tool. `console/layer-1/BalanceTopup.tsx:327-331` hides every error that contains 'amount', 'balance', 'validation' or 'subnet' from the error box. 'subnet' and 'validation' errors show under those fields (`:254, 268`), 'amount' errors only as a red border (`:293`), and 'balance' errors nowhere: a P-Chain 'insufficient balance' failure shows nothing.
9. Wrong default on remove-expired. `console/permissioned-l1s/remove-expired-registration/RemoveExpiredValidatorRegistration.tsx:515` says 'defaults to last 100k blocks', but `:194` starts at block 0. On the C-Chain that is thousands of `eth_getLogs` calls. 'Search All' (`:524-529`) sets the same 0.
10. A selection that never completes. `components/SelectValidationID.tsx:277-290` finds the NodeID only in the list that loaded at mount. A Validation ID typed or pasted before the list loads keeps an empty NodeID, and 'Initiate Change Weight' and 'Initiate Validator Removal' stay disabled with no message (`console/permissioned-l1s/change-weight/InitiateChangeWeight.tsx:244-258`; `console/permissioned-l1s/remove-validator/InitiateValidatorRemoval.tsx:251-265`). A failed list read only logs to the console (`SelectValidationID.tsx:119-121`), and the field looks ready.
11. A rules-of-hooks break. `components/console/step-flow.tsx:198-210` returns early, then calls `useMemo`. An unknown step key changes the hook count.
12. Validator flows lose the subnet on reload. `stores/addValidatorStore.ts:105-108`, `stores/changeWeightStore.ts:73-76` and `stores/removeValidatorStore.ts:66-69` do not persist `subnetIdL1`, so a reload on any later step shows 'Select an L1.' With `?subnetId=` in the URL, the page sets the subnet again and that clears the tx hash, the validator balance and the proof of possession (`app/console/add-validator/[step]/client-page.tsx:15-18`; `stores/addValidatorStore.ts:64-75`). On the P-Chain Registration step 'Sign & Submit to P-Chain' then cannot run: the balance and the proof are gone and the page has no field for them.
13. The wrong signing subnet while details load. `console/add-validator/steps/PChainRegistrationStep.tsx:79`, `console/add-validator/steps/CompleteRegistrationStep.tsx:80` and `console/remove-validator/steps/PChainRemovalStep.tsx:76` fall back to the L1's own subnet until `useVMCAddress` returns. For a manager on the C-Chain the Primary Network must sign, so an early click asks the wrong validators and fails after the page's retries. The change-weight P-Chain step instead refuses with a message (`SubmitPChainTxWeightUpdate.tsx:199-205`); the other steps could do the same. The change-weight Complete step does not (finding 37).
14. Proxy Setup forgets the ProxyAdmin. The new ProxyAdmin address is React state only (`console/permissioned-l1s/validator-manager-setup/ProxySetup.tsx:101, 340`). After a reload between the two deploys the page offers 'Deploy' again, and the user deploys a second ProxyAdmin. No field takes an existing ProxyAdmin address.
15. A P-Chain confirmation timeout reads as a failure, and the tx ID is lost. `utils/pchainConfirmation.ts:10-32` gives up after 60 s. Create Subnet and Create Chain keep the issued ID and warn that it may still commit (`CreateSubnet.tsx:85-90, 117-136`), but the register step, the weight step, the top-up and Disable show only an error and keep no tx ID (`SubmitPChainTxRegisterL1Validator.tsx:166-174`; `SubmitPChainTxWeightUpdate.tsx:263-270`; `BalanceTopup.tsx:133-143`; `DisableValidator.tsx:168-176`). The user can send the tx again.

### B: accessibility

16. Most toolbox fields have no tied label. `components/Input.tsx:93` sets `htmlFor={id}` with no fallback id. 124 of 132 `<Input />` uses in `components/toolbox` pass no `id` (counted with a script on 2026-10-04). On this path: the subnet fields (`Initialize.tsx:285`, `InitValidatorSet.tsx:437-442`, `change-weight/steps/SelectSubnetStep.tsx:21-26`, `BalanceTopup.tsx:250-255`, `DisableValidator.tsx:270-278`), 'Validation ID' (`SelectValidationID.tsx:294-301`), 'Manager Chain ID' and 'Manager Contract Address' (`ConvertSubnetToL1.tsx:225-245`), the tx hash and tx ID fields (`SubmitPChainTxRegisterL1Validator.tsx:230-236`, `CompletePChainRegistration.tsx:388-395`). Fix: `useId()` in `Input`.
17. Raw `<label>` elements with no `htmlFor`: 'Node ID (must be unique)', 'Consensus Weight', 'Validator Balance (P-Chain AVAX)' (`components/ValidatorListInput/ValidatorItem.tsx:80-83, 101, 124-126`), the owner addresses (`components/OwnerAddressesInput.tsx:39`), 'Proxy Address' and 'New Implementation (ValidatorManager)' (`ProxySetup.tsx:444-453, 489-498`), 'Admin Address', 'Churn Period (sec)', 'Max Churn %' (`Initialize.tsx:306-339`), 'Conversion Tx ID (P-Chain)' (`InitValidatorSet.tsx:444-453`), 'Amount' (`BalanceTopup.tsx:281-298`), 'From Block' (`RemoveExpiredValidatorRegistration.tsx:513-523`), 'Chain Name' (`components/genesis/ChainConfigStep.tsx:60-76`), 'Select Validator to Disable' (`ValidatorSelector.tsx:99-101`). Consensus Weight and Validator Balance have no placeholder either, so they have no accessible name at all.
18. Fields with no label of any kind: the JSON field of the 'API Response' tab (its name is a long JSON placeholder: `AddValidatorControls.tsx:295-308`), the manager address on Initialize (`Initialize.tsx:225-231`), the proxy implementation field (`ProxySetup.tsx:619-625`), 'Already have a Subnet ID?' (`CreateSubnet.tsx:154-162`, `label=""`), the bridge amount (`console/primary-network/CrossChainTransfer.tsx:630-646`, `label=""`), the validator search (`ValidatorSelector.tsx:140-146`).
19. Two buttons share one name: 'Deploy' for the ProxyAdmin and for the proxy (`ProxySetup.tsx:573-581, 599-612`). Two 'Add Address' buttons per validator card (`OwnerAddressesInput.tsx:103-113`, once per owner). Two 'Already deployed? Enter the address' buttons on Deploy Validator Manager (`DeployValidatorManager.tsx:276-280, 375-382`).
20. Icon-only controls with no name or only a `title`: the refresh button on Proxy Setup (`ProxySetup.tsx:455-462`), 'Check status' on Initialize (`Initialize.tsx:232-239`), the copy button, the explorer link and the balance refresh on the top-up tool (`BalanceTopup.tsx:217-235, 315-322`), 'Remove validator' (`ValidatorItem.tsx:62-72`).
21. Clickable `div` elements: the validator card header (`ValidatorItem.tsx:51-59`) and the field suggestions (`components/Input.tsx:151-171`) take mouse clicks only. They have no role and no keyboard access. A keyboard user cannot pick a validator on change weight, top-up or remove.
22. No selected state: the questionnaire cards have no `aria-pressed` and no radio role (`CreateL1Questionnaire.tsx:93-110`). The step pills have no `aria-current="step"`, and the step `nav` has no name (`step-flow.tsx:264-303`).
23. Errors are silent: `components/Alert.tsx:35-42` has no `role="alert"` or `role="status"`, and several steps render errors as plain `div` or `p` elements (`DeployValidatorManager.tsx:389-393`, `ProxySetup.tsx:412`, `InitValidatorSet.tsx:580-585`).
24. Empty headings: `ConvertSubnetToL1.tsx:258` and `add-validator/steps/InitiateRegistrationStep.tsx:110` pass `label=""`, and `components/ValidatorListInput.tsx:55` renders an empty `h2`.
25. Blocked controls stay exposed: `components/ChainGate.tsx:241` keeps the step under `pointer-events: none` and `opacity-40`, but not `inert` or `aria-hidden`. Screen readers and keyboard users still reach controls that do nothing.
26. The 'Core' image alt starts every P-Chain button name ('Core Create Subnet': `CoreWalletTransactionButton.tsx:105`). An empty alt would give the plain action name.
27. Busy labels never show. `components/Button.tsx:85-89` renders `loadingText` or 'Loading...' and drops the children, so the busy labels that steps put in the children never appear: 'Aggregating...' (`InitValidatorSet.tsx:487-495`), 'Aggregating signatures…' (`SubmitPChainTxWeightUpdate.tsx:402-409`), 'Processing...' (`CompletePChainRegistration.tsx:467-480`, `CompletePChainWeightUpdate.tsx:480-493`, `CompleteValidatorRemoval.tsx:369-389`). A screen reader hears 'Loading...' for all of them.

### C: text and consistency

28. 'Ensure port 9651 is open on all validators' shows for a C-Chain manager too, where the Primary Network signs (`InitValidatorSet.tsx:431-433`). 'Aggregate BLS signatures from L1 validators' is also wrong for a C-Chain manager (`SubmitPChainTxRegisterL1Validator.tsx:285`).
29. After a successful Initialize, the only feedback is 'Contract already initialized' in amber with an alert icon (`Initialize.tsx:254-269, 343-347`). It reads like a warning.
30. On the C-Chain, Proxy Setup first shows a red 'No proxy admin found at this address...' for `0xfacade...`, before the user does anything (`ProxySetup.tsx:71, 245-247`).
31. Step and tool names differ: step 'Deploy Validator Manager' opens tool 'Deploy Validator Contracts' (`console/create-l1/generateSteps.ts:178` vs `DeployValidatorManager.tsx:56`). Step 'Convert to L1' opens 'Convert Subnet to L1' (`ConvertSubnetToL1.tsx:31`). Step 'Docker Node Setup' opens 'L1 Node Setup with Docker' (`AvalancheGoDockerL1.tsx:437`). The Review list says 'Create Chain + Genesis' and 'Init Validator Set' (`generateSteps.ts:378, 387`) for steps titled 'Create Chain' and 'Initialize Validator Set'.
32. PoA text says 'stake': 'current L1 total stake' and 'current total L1 stake' (`ValidatorItem.tsx:116`; `InitiateValidatorRegistration.tsx:99`; `InitiateChangeWeight.tsx:132`). A PoA L1 has weight, not stake.
33. The disable warning says to use it only when the L1 is down (`DisableValidator.tsx:71-73, 262-266`). Disable is also the normal way to retire the last validator of a PoA L1.
34. The Disable success links to the legacy explorer `subnets-test.avax.network` (`DisableValidator.tsx:240`). Other tools link to `/explorer/fuji/p-chain/tx/` (`components/Success.tsx:30`, `BalanceTopup.tsx:164`).
35. The balance hint hardcodes 'a fee of 1.33 AVAX per month' (`ValidatorItem.tsx:149-150`). It is right only while the fee stays at the 512 nAVAX/s minimum.
36. The question count jumps: the first screens say 'of 4', and after 'On C-Chain' they say 'of 6' (`CreateL1Questionnaire.tsx:283-290, 379, 510`).

### Found in the live runs (2026-10-04)

37. (A) The change-weight Complete step can sign with the wrong subnet, and shows no sign that the details loaded. `console/shared/CompletePChainWeightUpdate.tsx:235` aggregates with `signingSubnetId || subnetIdL1`. `console/permissioned-l1s/change-weight/steps/CompleteWeightChangeStep.tsx:35` passes the context value, which is empty until `useVMCAddress` returns. For a C-Chain manager an early click asks the L1's own validators and fails after the page's retries. The change-weight steps show no `ManagerTypeBadge`, so a user cannot see when it is safe to click. Fix: refuse while the signing subnet is empty, as `SubmitPChainTxWeightUpdate.tsx:199-205` does.
38. (C) Change weight takes no `subnetId` query. Add validator and remove validator read `?subnetId=` (`app/console/add-validator/[step]/client-page.tsx:15-18`, `app/console/remove-validator/[step]/client-page.tsx:55-58`). Change weight does not (`app/console/permissioned-l1s/change-validator-weight/[step]/client-page.tsx`), so a link cannot open it on an L1, and the user types the subnet ID again.

### Found in the live runs (2026-10-05)

39. (A, fixed on this branch) A full load of a create-L1 step always went back to the questionnaire. `app/console/create-l1/[step]/client-page.tsx` redirected to `/console/create-l1` when the flow store had no answers. In the render that hydrates the server HTML, zustand gives the store's initial state (`getInitialState`, no answers), not the answers in localStorage, so the redirect ran on every reload, bookmark or pasted step URL. The page now redirects only after hydration. Tier 1's reload between the two proxy deploys (2.4) found it.

### Found by the Console bug hunt (2026-10-05)

Eight charters of `tests/e2e/explore/console/` ran on a dev server of this branch with the watch-only wallet. A person checked each finding by hand. `icm-ictt-setup` is now two charters, `icm-setup` and `ictt-setup`; the table uses the new keys. Severity is the bug hunt's: high, medium or low.

| ID | Charter | Severity | Problem | Status |
|---|---|---|---|---|
| F-01 | console-navigation | high | Ctrl+K opens the docs search and the Console palette together, and the focus goes to the docs search (`components/console/command-palette.tsx`). | Fixed in this PR |
| F-02 | console-navigation | medium | The palette matches the letters of the query anywhere in the description, so a title match ranks low: 'add validator' selects Validator Lookup first. | Fixed in this PR |
| F-03 | console-navigation | low | The palette footer shows the escape text `↑ ↓`, not the arrows. | Fixed in this PR |
| F-04 | primary-stake | medium | The Stake page's CLI commands have no BLS flags, so platform-cli refuses them. `PCHAIN_COMMANDS.addValidator` has the same gap, and `registerL1Validator` has no `--pop`. | Fixed in this PR |
| F-05 | primary-stake | medium | A stake above the P-Chain balance shows a raw avalanchejs error, and a BLS key that is not valid shows 'Cannot find square root'. | Fixed in this PR |
| F-06 | node-setup | medium | A Fuji Validator node config turns on the debug APIs, and the page shows no toggle for them for that node type. | Fixed in this PR |
| F-07 | node-setup | medium | The Primary Network backup command copies the root-owned key files without sudo. | Fixed in this PR |
| F-08 | node-setup | low | 'needs no env vars' shows above a command with two `-e` flags. The Custom VM note names the Docker command, not `aliases.json`, as the home of the VM alias. | Fixed in this PR |
| F-09 | icm-setup | medium | The managed relayer card says 'no funding', but Step 3 tells the user to fund the relayer. | Fixed in this PR |
| F-10 | ictt-setup | medium | The 'View on GitHub' links of the contract source viewer return 404. | Fixed in this PR |
| F-11 | ictt-setup | medium | A rejected ExampleERC20 deploy shows a raw viem error of 6,546 characters. A Verify of an address with no token shows the full viem text. | Fixed in this PR |
| F-12 | ictt-setup | low | The ExampleERC20 text says 1,000,000 tokens. The contract mints 10,000,000,000. | Fixed in this PR |
| F-13 | create-l1-questionnaire | medium | 'Already have a Subnet ID?' shows the green confirmed box for any typed value. | Fixed in this PR |
| F-14 | primary-stake | low | A refused network switch in the header shows no message. The ICTT switch toast shows the full viem text. | Fixed in this PR |
| F-15 | add-validator | medium | The tools show different texts for a wallet rejection, and no text says what to do next. | Fixed in this PR |
| F-16 | c-p-bridge-history | low | The bridge's 'Max:' line shows the full balance, but MAX fills the balance less the fee buffer. | Fixed in this PR |
| F-17 | create-l1-questionnaire | medium | The step bar ticks each step before the current one, also a step that is not done. | Waits for the owner |
| F-18 | create-l1-questionnaire | low | (1) The chooser says 'Question 1 of 4'. (2) Docker is the hosting default, but Managed has the Recommended badge on testnet. (3) The Review text names the answers, but the screen does not list them. | Items 1 and 3: fixed in this PR. Item 2: waits for the owner |
| F-19 | create-l1-questionnaire | low | The relayer toggle says '~30s deploy', and the note under Create Chain says 1 to 2 minutes. | Fixed in this PR |
| F-20 | node-setup | low | The Storage and Open ports tiles do not change with the node type. The Primary Network page says 1 TB for a validator, and its chart reaches 1.3 TB in one year. | Fixed in this PR |
| F-21 | add-validator | low | Node Setup sends the node values only to Convert to L1, also for an L1 that runs already (Add Validator). | Fixed in this PR |
| F-22 | ictt-setup | low | The ICTT text says 'Phase 1' to 'Phase 6'. The step bar uses the step names. | Fixed in this PR |
| F-23 | c-p-bridge-history | low | The History page shows no empty state to a user who is not signed in and has no local transactions. | Fixed in this PR |
| F-24 | create-l1-questionnaire | low | The CLI copy button cannot be seen when it has the keyboard focus, and it does not announce 'Copied'. | Fixed in this PR. The copy buttons of the transaction button's CLI box (`CoreWalletTransactionButton.tsx`) and of the 'or via CLI' box (`components/console/cli-alternative.tsx`: Stake, C/P bridge and six other tools) show a focus ring and announce 'Copied' |
| F-25 | primary-stake | low | The Stake page does not say where the rewards and the returned stake go. Manage Auto-Renewal step 3 asks for a NodeID after the lookup found no validator. | Fixed in this PR |
| F-26 | add-validator | low | Add Validator fills in a weight of 100, and the warning gives no valid number to enter. | The warning: fixed in this PR. It gives the largest valid weight ('Enter 19 or less.'). The default weight of 100 (`ValidatorListInput/AddValidatorControls.tsx`): open |
| F-27 | icm-setup | low | The managed relayer form opens with one chain as the source and the destination, and shows an error at once. | Fixed in this PR. The managed form of the ICM Relayer step and the 'Add a new relayer' form of the managed relayers page (`managed-testnet-relayers/CreateRelayerForm.tsx`) start with the first chain as the source and the second as the destination. The self-hosted form (`icm/setup/ICMRelayer.tsx`) starts with the first other chain as the destination |
| F-28 | node-setup | low | Node Setup suggests the L1s of the wallet's network, not of the page's Network setting. | Fixed in this PR |
| F-29 | console-navigation | low | One task has many names: 'ICTT Bridge', 'ICTT Setup', 'Interchain Token Transfer'. Add Validator opens with the heading 'Select L1 Subnet'. | Fixed in this PR. The palette group names (from `ToolCard.category` in `toolbox/tools.ts`) still differ from the sidebar sections: open |

False positives, no change: the login gate on localhost (`isDevLocalhostBypass`, so run the account-gated charters on a preview), field checks that run on submit only, the ACP-236 docs page that `yarn build:remote` writes, the storage legend labels, and the ACP links on Deploy Validator Manager.
