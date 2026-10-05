# Console map: tier 1 (PoA L1, Validator Manager on the Fuji C-Chain)

This map tells a test author, for each tier 1 step, which controls the test touches, what the page shows on success, which chain read proves the step, and which traps the code has. It also lists the UX problems found on the way.

Source: a code read of this worktree (base `7ddcb814a`) on 2026-10-04, checked line by line against the components. On 2026-10-04 `chain/poa-cchain.e2e.ts` used these names in live runs against build.avax.network: every step of sections 2.1 to 2.9 and 2.11 to 2.16 passed (2.0, 2.10 and 2.15 are not in the test yet). Line numbers are in this worktree.

Notation:

- `role 'name'` means `screen.getByRole(role, 'name')` (e2e 0.17.0, `docs/reference/screen.mdx`). A string name matches the whole name. A `/regex/` name matches as written.
- `placeholder '...'` means `screen.getByPlaceholder('...')`. Playwright uses the placeholder as the accessible name of a field that has no label, so `role 'textbox'` with the placeholder text also works.
- `css: <selector>` means `browser.locator('<selector>')`. Use it only where the Console gives the control no accessible name. Put a comment in the test that names the missing label. Section 4 lists each one as a UX finding.
- Chain helpers are in `chain/lib/chain.ts`: `waitForPTx`, `pSubnet`, `pIsL1`, `pL1Validator`, `pBalance`, `cHasCode`, `waitForCTx`, `managerValidator`, `managerNodeValidationId`, `managerTotalWeight`, `managerSubnetId`, `managerIsValidatorSetInitialized`, `glacierSubnet`, `waitForGlacierSubnet`, `glacierL1Validators`, `initialValidationId`, `nodeIdToHex`, `ValidatorStatus`.
- The signer records each send in `wallet.signer.sends` (`chain/lib/fixtures.ts`). Take every tx ID and contract address from that record and from the receipts, not from the page. The page often shortens them or does not show them.
- The mock validators come from `chain/lib/mock-validator.ts` (section 3).

## 1. Facts that apply to every step

### 1.1 Open pages as a returning visitor

A first Console visit opens the dialog 'Welcome to Builder Console' 800 ms after mount (`components/console/onboarding-tour/welcome-modal.tsx:36, 64`). The open dialog hides the page from the accessibility tree. The privacy banner also shows. `answerFirstVisitPrompts(browser)` in `lib/visitor.ts` writes both answers to localStorage. Two ways to use it:

- Open any page of the site first, then call it (as `site/helpers.ts` `openAsReturningVisitor` does).
- Better for the chain tests: write the same three keys in an init script (`browser.addInitScript` in the fixture, before the first `app.open`), so no extra page load is needed.

### 1.2 Wallet connection

The provider is an init script (`chain/wallet/provider.ts`, `web({ initScripts })`). It announces EIP-6963 rdns `app.core`, name `Core`. The site has no grant until the user connects (`chain/wallet/bridge.ts`), so wagmi never connects by itself. Each session connects once:

1. `button 'Connect Wallet'` in the header (`components/toolbox/components/console-header/evm-network-wallet/index.tsx:39-46`). A tool page without a wallet also shows the gate `css: [data-console-tool-gate]` with `heading 'To use this tool you need:'` and `button 'Connect'` (`components/toolbox/components/CheckRequirements.tsx:118-128, 239-246`; label from `hooks/useWalletRequirements.ts:26-31`). Both open the RainbowKit modal.
2. `dialog 'Connect a Wallet'` (RainbowKit 2.2.10: role dialog, labelled by the 'Connect a Wallet' h1). In it, `button /^Core( Recent)?$/`. The name is the wallet name, plus 'Recent' after an earlier connect in the same browser. RainbowKit gives the icon no name. Fallback: `screen.getByTestId('rk-wallet-option-app.core')` (RainbowKit sets `data-testid="rk-wallet-option-<connector id>"`).
3. Success: the header shows the P-Chain button: `button /^P-Chain Logo P-Chain .* AVAX$/` (image alt 'P-Chain Logo', text 'P-Chain', the balance; `console-header/pchain-wallet/index.tsx:47-67`). It renders only when the Console has the Core client and the P-Chain address.

Rules:

- Wait for the P-Chain button after each full load (`app.open`, `browser.reload`, `browser.goto`) before you touch anything. Before the wallet reconnects, `isTestnet` is false, so every flow store reads the mainnet copy of its data (`stores/createFlowStore.ts:44-80`, `stores/walletStore.ts` initial `isTestnet: false`), and the C-Chain steps show the network gate.
- The Console treats the wallet as Core when the connector id is `app.core` (`console-header/WalletSync.tsx:145-153`) or when the injected provider is `window.avalanche` or has `isAvalanche` (`:155-184`). Then it sets `walletType` 'core' (`:236`). Without that, the P-Chain buttons show a `platform-cli` command and the warp steps show a `cast` command instead of a button (`CoreWalletTransactionButton.tsx:96-117`; `InitValidatorSet.tsx:560-572`; `CompletePChainRegistration.tsx:465-482`).
- On a fresh connect to a chain other than 43113, the Console asks the wallet to switch to Fuji (`WalletSync.tsx:53-60`). Start the signer on 43113.

What the Console asks of the wallet (for the signer owner):

- Before each P-Chain tx: `wallet_getEthereumChain`. It must return `isTestnet: true`, or the Console switches the chain first (`coreViem/index.ts:143-161`, `hooks/useSubmitPChainTx.ts:20-37`). Then `avalanche_sendTransaction` through the SDK.
- Deploy Validator Manager: `wallet_addEthereumChain` and `wallet_switchEthereumChain` for 43113 before each deploy (`DeployValidatorManager.tsx:111-112, 154-155`).
- The amber notice 'Your wallet uses a different RPC URL for this chain' shows when `wallet_getEthereumChain` gives an `rpcUrls[0]` other than `https://api.avax-test.network/ext/bc/C/rpc` (`hooks/useWalletRpcAdvisory.ts:23-42`; `stores/l1ListStore.ts:50-53`).
- Contract calls send `eth_sendTransaction` with a nonce that the page sets to the pending count, and the warp steps add an `accessList` (`hooks/contracts/useContractActions.ts:91, 142-157`).

### 1.3 Tool chrome and step flow

- Each tool renders `css: [data-console-tool="<tool title>"]` with `heading '<tool title>'` level 1 (`components/toolbox/components/Container.tsx:25-31`). The tool title can differ from the step title (section 4, C).
- A step flow renders `css: [data-console-flow]` (`components/console/step-flow.tsx:262`). 'Next' and 'Back' are links: `link 'Next'`, `link 'Back'` (`:395-400, 456-461`). The last step has `button 'Finish'` (`:434-441`). The step pills are links too. A done step's name is its title; another step's name is its number and its title, for example '2 Deploy Validator Manager'.
- 'Next' is never gated (`step-flow.tsx:443-463`). The questionnaire's 'Continue' is gated only on the first screen (`CreateL1Questionnaire.tsx:438-451`).
- `ChainGate` wraps each step (`step-flow.tsx:375-377`). P-Chain and 'any' steps pass through (`ChainGate.tsx:53-55`). On a C-Chain step with the wallet on another chain it shows `heading 'Connect to Fuji C-Chain'` and `button 'Switch Network'` (`:178, 194, 210-219`). The step stays in the page under `pointer-events: none` (`:241`), so role queries still find its controls, but a click times out. Tier 1 stays on 43113.

### 1.4 Button names change while busy

- Every P-Chain tx button (`CoreWalletTransactionButton`) puts the image alt 'Core' before its text (`CoreWalletTransactionButton.tsx:105`). 'Create Subnet' is `button 'Core Create Subnet'`.
- While busy, a button shows its loading text in place of its label (`CoreWalletTransactionButton.tsx:106-110`; `components/toolbox/components/Button.tsx:85-89`). The toolbox `Button` shows `loadingText`, or 'Loading...' when the step passes none, and drops the busy label that the step puts in the children. A locator by the idle name stops matching while the button is busy.
- So wait for the success signal or for the error box, not for "button enabled". The busy names are listed per step.

### 1.5 Errors and toasts

- `Alert` has no role (`components/toolbox/components/Alert.tsx:35-42`). `role 'alert'` finds nothing. Read errors by text. Several steps render errors as plain `div` or `p` elements. The error texts are listed per step.
- The Console also shows sonner toasts. They go away by themselves. Do not use a toast as the success signal.
- If an error box contains '429' or 'Too Many Requests', stop the test. Do not click again.

### 1.6 State: what survives a reload

A serial group shares app state (`docs/reference/test.mdx:299`), so localStorage carries from one member to the next.

| localStorage key | Holds | Lost on reload | Cleared by |
|---|---|---|---|
| `v4-create-l1-flow` | questionnaire answers, step index | nothing | 'Start deployment' sets new answers; closing the Finish modal clears it (`app/console/create-l1/[step]/client-page.tsx:43-45`) |
| `v4-create-chain-store-testnet` | `subnetId`, `chainID`, `chainName`, `managerAddress` (the proxy after Proxy Setup), `genesisData`, `evmChainId`, `convertToL1TxId` | nothing | 'Start deployment' (`CreateL1Questionnaire.tsx:330-341`) |
| `v4-toolbox-storage-43113` | `validatorMessagesLibAddress`, `validatorManagerAddress` | nothing | 'Start deployment'; 'Redeploy' |
| `v4-add-validator-store-testnet` | validator list, `evmTxHash`, `validatorBalance`, `blsProofOfPossession`, `pChainTxId` | `subnetIdL1` (not persisted, `stores/addValidatorStore.ts:105-108`) | setting the subnet (`:64-75`) |
| `v4-change-weight-store-testnet` | `nodeId`, `validationId`, `newWeight`, `evmTxHash`, `pChainTxId` | `subnetIdL1` (`stores/changeWeightStore.ts:73-76`) | setting the subnet (`:41-50`) |
| `v4-remove-validator-store-testnet` | `nodeId`, `validationId`, `evmTxHash`, `pChainTxId` | `subnetIdL1` (`stores/removeValidatorStore.ts:66-69`) | setting the subnet |

React state is lost on any reload or remount: signatures, the ProxyAdmin address on Proxy Setup, the 'Transaction Completed' state of initiate buttons.

### 1.7 Reload or remount

- Create flow steps: a reload is safe. The IDs come back from `v4-create-chain-store-testnet`.
- Add validator, change weight, remove: never reload in the middle. A reload loses `subnetIdL1`, and every later step shows 'Please select an L1 subnet first.' Opening the URL again with `?subnetId=` sets the subnet but also clears the tx hash, the balance and the proof of possession (`app/console/add-validator/[step]/client-page.tsx:15-18`; `addValidatorStore.ts:64-75`). To get a fresh component on a step, remount it: `link 'Back'`, then `link 'Next'` (client navigation keeps the store and mounts the step again). Do not click the initiate button on the way back: its 'Transaction Completed' state is gone and it is enabled again.
- To start a validator flow clean, open its first step URL (with `?subnetId=` where the flow takes it). Setting the subnet clears the old validator, tx hash and P-Chain tx ID.

### 1.8 Glacier: what each page reads, and the Node pre-wait

None of these reads retries. Each runs on mount and again only when its inputs change (subnet ID; for `useVMCAddress` also the wallet chain and network). A read that ran before Glacier indexed the new state leaves the page without data until a remount. Rule: poll Glacier from Node first, then open or remount the page. Write the measured lag to the ledger.

| Page | Read | Effect of a miss | Node pre-wait |
|---|---|---|---|
| Convert to L1 | `SelectSubnet` → Data API `getSubnetById` once (`components/SelectSubnet.tsx:33-81`) | 'Core Convert to L1' stays disabled (`ConvertSubnetToL1.tsx:124, 301`) | `waitForGlacierSubnet(subnetId)` |
| Every validator tool | `useVMCAddress` → Glacier subnet `isL1` and `l1ValidatorManagerDetails`, then the manager's blockchain (`hooks/useVMCAddress.ts:63-184`) | error 'Selected subnet is not an L1 or doesn't have a Validator Manager Contract.'; no manager address, no signing subnet | `waitForGlacierSubnet(subnetId, { converted: true })` |
| Change weight, top-up, remove | `SelectValidationID` → `listL1Validators` with inactive validators, weight > 0 (`components/SelectValidationID.tsx:84-127, 214-257`) | the validator is not in the suggestions; a failed read shows nothing | `glacierL1Validators(subnetId, { includeInactive: true })` lists the validator |
| Disable | `ValidatorSelector` → `listL1Validators`, active only, weight > 0 (`disable-validator/ValidatorSelector.tsx:26-61`) | 'No active validators found for this subnet.' | `glacierL1Validators(subnetId)` lists V0 |
| Subnet fields (`InputSubnetId`) | Glacier subnet, 500 ms after each change (`components/InputSubnetId.tsx:55-91`) | red 'Subnet ID not found or invalid' under the field; blocks nothing | none |

Initialize Validator Set needs no wait: it takes the conversion tx ID from the store when Glacier does not have it yet (`InitValidatorSet.tsx:192-221`).

### 1.9 Warp deliveries and `deliverWithRetry`

`deliverWithRetry` (`chain/lib/warp.ts`) gets `landed`, `aggregate` and `deliver`. Each attempt needs a new signature. The pages differ:

| Step | Fresh signature for an attempt | `deliver` waits for | `landed` |
|---|---|---|---|
| Initialize Validator Set | reload the page, then `button 'Aggregate Signatures'`, wait for 'Signature aggregated'. The page keeps one signature per mount and reuses it on each 'Initialize Validator Set' click (`InitValidatorSet.tsx:322, 466-496`) | 'Validator set initialized' or the red error box (`:552-556, 580-585`) | `managerIsValidatorSetInitialized(proxy)` |
| Add validator, P-Chain Registration | one button aggregates and sends. After a failure the button is gone (`SubmitPChainTxRegisterL1Validator.tsx:148, 294-332`): remount (`link 'Back'`, `link 'Next'`) | the store's `pChainTxId` is set, or 'P-Chain transaction failed:' | `pL1Validator(validationId) !== null` |
| Complete Registration | each click aggregates again. A failed simulation leaves the button enabled; a sent tx that reverted disables it (`CompletePChainRegistration.tsx:306-311, 357-363`): then remount | 'Registration completed' or the error box | `managerValidator(...).status === Active` |
| Change weight and remove, P-Chain step | `button 'Aggregate Signatures'`; for a retry `button 'Re-aggregate signatures'` (`console/shared/SubmitPChainTxWeightUpdate.tsx:388-411`) | 'P-Chain tx confirmed:' or 'P-Chain submission failed:' (`:424-433, 263-270`) | `pL1Validator` weight 12, or null after removal |
| Complete Weight Change | as Complete Registration (`CompletePChainWeightUpdate.tsx:281-286, 338-345`) | 'Success! The validator weight has been updated successfully.' | `receivedNonce === sentNonce` |
| Complete Removal | each click aggregates again; a reverted tx leaves the button enabled (`CompleteValidatorRemoval.tsx:206-214, 369-389`) | 'Validator removal completed' | status `Completed` |

Timing: one click can take minutes. The page itself retries a below-quorum or transient aggregation up to 4 times, 5, 10 and 20 s apart, and each attempt can last 60 s (`utils/aggregationRetry.ts:24-25`; `stores/useAvalancheSDKChainkit.ts:17, 82-97`). Give `deliver` a 5 min wait, then let `deliverWithRetry` wait its 15 s.

Signing subnet: on a C-Chain manager the Primary Network signs. The pages take the signing subnet from the manager details (`useVMCAddress`), but three steps fall back to the L1's own subnet while those details load (`PChainRegistrationStep.tsx:79`, `CompleteRegistrationStep.tsx:80`, `PChainRemovalStep.tsx:76`). An early click then asks the mock validators, which cannot sign. Before each warp click in the validator flows, wait for the badge 'PoA · EOA' in the step header (the details have loaded when it shows; CSS shows it in upper case, the text is mixed case), or for the row 'Signing Subnet ID' with `11111111111111111111111111111111LpoYY` in 'Validator Manager Details'.

### 1.10 Requests that the page makes by itself

Count these when you set your own poll rate. They are the app's requests; the Node code still uses public endpoints only, under 2 per second.

- After each P-Chain tx, `waitForPChainConfirmation` polls `platform.getTxStatus` every 2 s for up to 60 s (`utils/pchainConfirmation.ts:10-32`). After 60 s the page reports a timeout, but the tx can still commit. Decide by the chain.
- The top-up tool reads the P-Chain balance every 10 s (`layer-1/BalanceTopup.tsx:88-94`).
- A failed contract simulation on Fuji makes the page call the site's own `/api/debug-rpc` (`useContractActions.ts:103-127`).
- Each warp click: one Glacier aggregation request per page-side attempt (up to 4).
- Remove expired registration: one `eth_getLogs` per 2,000 blocks from 'From Block' to the head (`RemoveExpiredValidatorRegistration.tsx:194-220`).

### 1.11 A false warning to ignore

`walletStore.pChainBalance` is a getter in the initial zustand state (`stores/walletStore.ts:231-233`). Zustand's `set` copies the state with `Object.assign`, which turns the getter into a plain value the first time any field changes. The value stays at the initial 0 (checked in Node with zustand 5.0.8: `balances.pChain` 1.38, `pChainBalance` 0). So the P-Chain steps of Add validator and Remove always show 'Insufficient P-Chain balance for transaction fees. You need at least 0.1 AVAX.' (`add-validator/steps/PChainRegistrationStep.tsx:19-23, 61-74`; `remove-validator/steps/PChainRemovalStep.tsx:28-31, 51-64`). It blocks nothing. Do not treat it as a failure. Convert, top-up and the bridge read `balances.pChain` and show correct values.

### 1.12 Before each send, and where to resume

Before each send, read the chain (and the ledger). If the effect is already there, do not click. This happens when the page reported a failure (most often the 60 s P-Chain confirmation timeout) but the tx landed. Then carry on with the ID from the signer's record:

| Step | "Already landed" check | Where the page takes the ID |
|---|---|---|
| Create Subnet | `pSubnet(subnetId)` exists | `placeholder 'Paste Subnet ID'` (`CreateSubnet.tsx:154-162`) |
| Deploy Validator Manager | `cHasCode(address)` for each contract | per card, `button 'Already deployed? Enter the address'`, then `textbox 'Already deployed? Enter the address'` (`ManualAddressInput.tsx:30-46`); both cards have it, so scope to the card with `heading 'Deploy ValidatorMessages Library'` or `heading 'Deploy ValidatorManager Contract'` |
| Proxy Setup | `cHasCode(proxy)` and the EIP-1967 slots | the ProxyAdmin address cannot be entered. Deploy a new ProxyAdmin, or put the proxy into Initialize's manager field (`placeholder '0x...'`, `Initialize.tsx:225-231`) |
| Initialize Validator Manager | `managerSubnetId(proxy)` is the subnet | none needed |
| Create Chain | `waitForPTx(chainId)` | none. Convert does not need the chain ID for a C-Chain manager |
| Convert to L1 | `pIsL1(subnetId)` | Initialize Validator Set: `placeholder 'txID...'` ('Conversion Tx ID (P-Chain)') |
| Initialize Validator Set | `managerIsValidatorSetInitialized(proxy)` | none needed |
| Add validator, initiate | `managerNodeValidationId(proxy, v1.nodeID)` is not zero | P-Chain step: `placeholder 'Enter the transaction hash from the previous step (0x...)'` |
| Add validator, P-Chain | `pL1Validator(validationId)` exists | Complete step: `placeholder 'Enter the P-Chain transaction ID from the previous step'` |
| Change weight, initiate | `managerValidator(...).weight === 12n` | P-Chain step: `placeholder 'Enter the transaction hash from step 2 (0x...)'` |
| Change weight, P-Chain | `pL1Validator(...).weight === 12n` | Complete step: `placeholder 'Enter the P-Chain transaction ID from the previous step'` |
| Remove, initiate | status `PendingRemoved` | the page shows a resend card instead (2.14) |
| Remove, P-Chain | `pL1Validator(v1) === null` | Complete step: `placeholder 'Enter the P-Chain SetL1ValidatorWeightTx ID from step 3'` |
| Top-up | V0's balance grew | none |
| Disable | `pL1Validator(v0).balance === 0n` | none |

### 1.13 The public API lags itself

`api.avax-test.network` is load-balanced, and its nodes accept a block at different times. On 2026-10-04 `platform.getTxStatus` said Committed for a ConvertSubnetToL1Tx, and the next `platform.getSubnet` came from a node that still showed no conversion. A Node check after a tx must poll until a node shows the result (`chainShows` in `chain/lib/chain.ts`, 90 s). The C-Chain RPC is the same; the test polls its checks too (`expect.poll`). The Console's own reads go to the same endpoints.

## 2. Steps

The create flow for PoA, manager on the C-Chain, Docker hosting has 8 steps (`components/toolbox/console/create-l1/generateSteps.ts:173-237`): `/console/create-l1/create-subnet`, `deploy-validator-manager`, `proxy-setup`, `initialize-manager`, `create-chain`, `docker-setup`, `convert-to-l1`, `init-validator-set`.

A step URL with no stored answers redirects to `/console/create-l1` (`app/console/create-l1/[step]/client-page.tsx:37-39`). Run the questionnaire first in the same session. Move between steps with `link 'Next'`.

### 2.0 C/P bridge (optional; only when the P-Chain balance is below 0.2 AVAX)

- Route: `/console/primary-network/c-p-bridge`. The tool gates itself on the Fuji C-Chain (`primary-network/CrossChainTransfer.tsx:610-617`).
- Controls:
  - Direction: text 'From C-Chain' or 'From P-Chain' (`:626`). `button 'Swap chains'` swaps them (`:652-660`).
  - Amount: `css: input[type="number"][step="0.000001"]`. The `AmountInput` gets `label=""` and no placeholder, so it has no accessible name (`:630-646`).
  - `button 'MAX'` (`:641-645`).
  - `button /^Export .* AVAX from /` (`:685-693`). The import runs by itself after the export.
- Success: `button 'Start New Transfer'` (`:769-790`).
- Chain check: `pBalance(P address)` grew by the amount minus fees; `cBalance(C address)` fell.
- Gotcha: a pending import from an earlier run shows 'Pending import from a previous transfer' and `button /^Import .* AVAX to /` (`:738-752`). Click it before a new export.

### 2.1 Questionnaire

- Route: `/console/create-l1`. Gate: wallet connected (`app/console/create-l1/page.client.tsx:9`).
- Each option card is a button. Its name is the title, the description and, on some cards, 'Recommended', run together (`create-l1/CreateL1Questionnaire.tsx:83-164`). Match the start of the name.
- Controls, in order (all headings are h2):
  1. `heading 'Choose a setup'`. `button /^Advanced setup/`, then `button 'Continue'` (`:406-451`). Here 'Continue' stays disabled until a card is picked.
  2. `heading 'Validator management'`. `button /^Proof of Authority/`, then 'Continue' (`:546-553, 888-895`). PoA is the default. Pick it before the next question anyway: picking a validator type resets the manager location to 'On the L1' (`:251-257`).
  3. `heading 'Validator Manager location'`. `button /^On C-Chain/`, then 'Continue' (`:611-619`).
  4. `heading 'Interoperability'` (shown only for the C-Chain). Keep the default `button /^Enable cross-chain messaging/`, then 'Continue' (`:655-663`).
  5. `heading 'Contract ownership'` (PoA on the C-Chain only). `button /^Single wallet/` (the default), then 'Continue' (`:703-711`).
  6. `heading 'Infrastructure'`. `button /^Docker/` (the default for Advanced, `:231`), then 'Continue' (`:759-767`). 'Managed' shows only on testnet.
  7. `heading 'Review your setup'`. The card 'Deployment steps' shows '8 steps' (`:811-815`). `button 'Start deployment'` (`:866-886`).
- From screen 2 on, 'Continue' is never disabled (`:888-895`). The answers are the defaults until a card is clicked.
- Progress text: the totals follow the answers (`:283-290, 379, 510`). The first screens say 'Question 1 of 4' and 'Question 2 of 4'. After 'On C-Chain' they say 'of 6'. The last screen says 'Review'. Do not assert a fixed total before question 3.
- Success: the URL becomes `/console/create-l1/create-subnet`. 'Start deployment' cleared the create stores (`:330-341`).
- Chain check: none.
- Gotchas:
  - The selected card has no `aria-pressed` and no radio role. Only its colors change. Check the choices on the Review screen: its list shows 'Deploy Validator Manager', 'Proxy Setup', 'Initialize Validator Manager', 'Create Chain + Genesis', 'Docker Node Setup', 'Convert to L1', 'Init Validator Set' after 'Create Subnet' (`generateSteps.ts:374-403`).
  - A stored flow shows the banner 'Resume your previous flow' on screen 2 (`:473-500`). Do not click 'Resume'.
  - The banner 'We recommend starting on Fuji testnet' shows when the wallet is on mainnet (`:365-372, 460-467`). Fail the test if it shows after the P-Chain header button is there.
  - Phone checkpoint: `browser.setViewport({ width: 390, height: 844 })` on any screen, check for no horizontal overflow, then set the desktop size again.

### 2.2 Create Subnet (P-Chain)

- Route: `/console/create-l1/create-subnet`. Tool title 'Create Subnet'.
- Control: `button 'Core Create Subnet'` (`layer-1/create/CreateSubnet.tsx:100-111`). Busy names: 'Core Creating...', then 'Core Confirming...'.
- Success: text 'Subnet ID (CreateSubnetTx)' and `link <subnet ID>` (`:113-115`; `components/Success.tsx:73-86`). Use `link /^[1-9A-HJ-NP-Za-km-z]{40,60}$/`.
- Error: 'Subnet ID (CreateSubnetTx, not confirmed)' with the issued ID, and an error box that says 'The transaction was issued and may still be committed on the P-Chain.' (`:117-136`).
- Chain check: the subnet ID is the CreateSubnetTx ID from the signer's record; compare it with the link text. `waitForPTx(subnetId)` gives 'Committed'. `pSubnet(subnetId)` shows the wallet's P address as the only control key, threshold 1.
- Gotchas:
  - After success the button stays enabled (`:105` disables it only after an unconfirmed failure). A second click creates a second subnet. Check the ledger before you click.
  - The field under 'Already have a Subnet ID?' shows the new subnet ID and checks it against Glacier after 3 s. 'Subnet ID not found or invalid' under it is expected while Glacier lags.

### 2.3 Deploy Validator Manager (C-Chain, 2 deploys)

- Route: `/console/create-l1/deploy-validator-manager`. Tool title 'Deploy Validator Contracts' (`permissioned-l1s/validator-manager-setup/DeployValidatorManager.tsx:55-60`).
- Controls:
  1. `button 'Deploy Library'` (`:268-275`). Busy name 'Loading...'.
  2. `button 'Deploy Contract'` (`:367-374`). Disabled until the library has an address. Busy name 'Loading...'.
- Success: each card shows the full address in a `code` element and `button 'Redeploy'` (`:242-259, 339-355`). After both deploys there are 2 'Redeploy' buttons.
- Error: a red box under the cards (`:389-393`).
- Chain check: take both addresses from the receipts (`contractAddress`) in send order. `cHasCode` for each. The page text holds the same full addresses.
- Gotchas:
  - Each deploy first calls `wallet_addEthereumChain` and `wallet_switchEthereumChain` for 43113, and checks that the RPC answers (`:84-88, 109-112`).
  - 'Redeploy' clears the stored addresses. Do not click it.
  - Fuji gas is about 160 wei, so both deploys cost almost nothing.

### 2.4 Proxy Setup (C-Chain, 2 deploys)

- Route: `/console/create-l1/proxy-setup`. Tool title 'Proxy Setup'.
- Controls:
  1. On the C-Chain the section 'Deploy New Proxy' opens by itself once the wallet chain is known (`validator-manager-setup/ProxySetup.tsx:84-98`). If `button 'Deploy'` is not there, click `button /^Deploy New Proxy/` (`:531-547`; its name ends with 'C-Chain / Custom').
  2. ProxyAdmin: `button 'Deploy'` (`:573-581`).
  3. Proxy: `button 'Deploy'` (`:599-612`). Disabled until the ProxyAdmin has an address. Its implementation field is filled with the ValidatorManager address (`:214-218`).
- Locator: two buttons are named 'Deploy'. Before the first deploy, take the enabled one: `screen.getByRole('button', 'Deploy', { disabled: false })`. After it, the ProxyAdmin button is gone and one 'Deploy' remains. Busy name 'Loading...'.
- Success: the section closes, and the upgrade card shows 'Proxy is up to date' (`:377-384, 504-508`).
- Error: a small red line at the top of the card (`:412`).
- Chain check: `cHasCode(proxyAdmin)`, `cHasCode(proxy)`. The EIP-1967 implementation slot of the proxy (`0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`) holds the ValidatorManager address. The admin slot (`0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`) holds the ProxyAdmin.
- Gotchas:
  - Before you deploy, the upgrade card reads the genesis proxy address `0xfacade...` on the C-Chain and shows 'No proxy admin found at this address. The contract may not be an EIP-1967 proxy.' (`:71, 245-247`). That text is expected here.
  - The page shows the new addresses cut to 10 characters (`:568-570, 594-596`). Take the full addresses from the receipts. After the proxy deploy, `managerAddress` in `v4-create-chain-store-testnet` is the proxy (`:383-384`).
  - Do not reload between the two deploys: the ProxyAdmin address is React state only (`:101, 340`).

### 2.5 Initialize Validator Manager (C-Chain)

- Route: `/console/create-l1/initialize-manager`. Tool title 'Initialize Validator Manager'.
- Defaults: admin = the wallet's C address, churn period 0 s, maximum churn 20 % (`validator-manager-setup/Initialize.tsx:50-52, 77-81`). The manager address is the proxy from the store. On the C-Chain the subnet comes from the store (`:87-92`).
- Wait for: 'Ready to initialize' (`:254-270`). The page reads `owner()`, then the `Initialized` logs of the last 2,000 blocks (`:109-154`).
- Control: `button 'Initialize Contract'` (`:349-357`). Disabled until 'Ready to initialize'. Busy name 'Loading...'.
- Success: 'Contract already initialized' replaces the button, and the status line says 'Already initialized' (`:258-262, 343-347`). The page shows no other success message.
- Error: an error box at the top of the card (`:199`).
- Chain check: `managerSubnetId(proxy)` equals the new subnet ID. `owner()` is the wallet's C address. Churn period 0.
- Gotchas:
  - Initialize binds the manager to the subnet for good. If the store holds a subnet from an old run, the step binds the wrong one. 'Start deployment' clears the store, so start each night with the questionnaire, and check the subnet field (`placeholder 'Enter subnet ID'`, label 'Select L1/Subnet' not tied, `:282-286`) before you click.
  - The subnet field can show 'Subnet ID not found or invalid' while Glacier lags. That does not block the button.

### 2.6 Create Chain (P-Chain)

- Route: `/console/create-l1/create-chain`. Tool title 'Create Chain'.
- The genesis builds by itself from the defaults: Subnet-EVM, a random EVM chain ID, the wallet as the first allocation and the PoA owner, Warp and the ICM messenger on (`layer-1/create/GenesisBuilder.tsx:303-330, 409-414`; `create-l1/generateSteps.ts:50-58`). The chain name is random, for example 'Brave Otter Chain' (`components/genesis/ChainConfigStep.tsx:16-35`).
- Control: `button 'Core Create Chain'` (`layer-1/create/CreateChain.tsx:313-325`). It shows only after the genesis is valid. Before that the card says 'Configure Genesis First' (`:303-311`). Busy names 'Core Creating Chain...', then 'Core Confirming...'.
- Success: text `Chain "<name>" created (CreateChainTx ID)` and `link <chain ID>` (`:327-336`). Use `screen.getByText(/^Chain ".*" created \(CreateChainTx ID\)$/)`.
- Error: 'CreateChainTx ID (not confirmed)' and an error box (`:338-360`).
- Chain check: the chain ID is the CreateChainTx ID from the signer's record. `waitForPTx(chainId)` gives 'Committed'.
- Gotchas:
  - After success the button stays enabled, and the name field gets a new random name (`:148-150, 318`). A second click creates a second chain on the subnet. Check the ledger before you click.
  - Phone checkpoint: below 1,024 px the genesis builder switches to its phone layout on the window's resize event (`components/genesis/GenesisWizard.tsx:354-365`), so `browser.setViewport` is enough; no reload.

### 2.7 Docker Node Setup (skipped)

- Route: `/console/create-l1/docker-setup`. Tool title 'L1 Node Setup with Docker' (`layer-1/AvalancheGoDockerL1.tsx:436-440`).
- Control: `link 'Next'`. Nothing gates it.
- Success: the URL becomes `/console/create-l1/convert-to-l1`.
- Chain check: none. The page reads Glacier for the subnet (`:307-351`); that read does not matter here.

### 2.8 Convert to L1 (P-Chain) with mock validator V0

- Route: `/console/create-l1/convert-to-l1`. Tool title 'Convert Subnet to L1' (`layer-1/create/ConvertSubnetToL1.tsx:31`).
- Before you open it: `waitForGlacierSubnet(subnetId)`. The page reads the subnet once (section 1.8). If the read missed, remount with `link 'Back'` and `link 'Next'`.
- Wait for:
  - `textbox 'Subnet'` holds the subnet ID (label tied by id `subnet-input`, `components/SelectSubnet.tsx:89-98`). If it is empty after a reload, fill it.
  - The helper 'A Validator Manager exists at this address on the C-Chain, so the C-Chain is selected.' (`ConvertSubnetToL1.tsx:232-237`). The page then puts the Fuji C-Chain ID `yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp` into 'Manager Chain ID' (`:105-111`). Check it with `screen.getByDisplayValue('yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp')`, and the proxy with `getByDisplayValue(proxy)`.
  - 'Checking the manager address on the C-Chain...' is gone (`:280`).
- Controls:
  1. `tab 'API Response'` is the default tab (`components/ValidatorListInput/AddValidatorControls.tsx:38, 220-225`). Do not click 'Managed Node' or 'Manual Input'.
  2. The JSON field has no label; its name is its placeholder. `placeholder /"nodePOP"/` (`:295-308`), `fill(nodeCredentialsJson(v0))`.
  3. `button 'Add Validator'` (`:310-318`).
  4. The validator card opens by itself and shows V0's NodeID (`components/ValidatorListInput/ValidatorsList.tsx:22-29`).
  5. Consensus Weight: `css: input[type="number"]:not([step]):not([min])`. The label is not tied, and the field has no placeholder (`ValidatorItem.tsx:101-113`). Keep the default 100.
  6. Validator Balance: `css: input[type="number"][step="0.000001"]`. The label 'Validator Balance (P-Chain AVAX)' is not tied (`ValidatorItem.tsx:124-147`). `fill('0.02')`. Use `fill`, not typed keys: the field converts each value to nAVAX at once, so a partial value like '0.' becomes 0.
  7. `button 'Core Convert to L1'` (`ConvertSubnetToL1.tsx:298-308`). Busy names 'Core Converting...', then 'Core Waiting for P-Chain confirmation...'.
- Success: none on the page. After the tx commits, the button is 'Core Convert to L1' again and stays enabled. The page reads the subnet only once, so it never shows 'Core Already Converted' in the same visit. Rely on the chain check. Never click again.
- Error: a yellow box with a list of problems above the button (`:289-297`; texts in `conversionChecks.ts:100-147`), or an error box under it (`:309`).
- Chain check: the conversion tx from the signer's record, `waitForPTx`. `pIsL1(subnetId)` is true; `pSubnet` shows manager chain = the C-Chain and manager address = the proxy. `pL1Validator(initialValidationId(subnetId, 0))` shows V0's NodeID, weight 100, a balance near 0.02 AVAX, and the wallet's P address as remaining-balance owner and deactivation owner (threshold 1).
- Gotchas:
  - The default validator balance is 0.1 AVAX (`AddValidatorControls.tsx:155-156`). Change it. The P-Chain accepts any balance above 0 (section 3).
  - The page also calls `GET /api/managed-testnet-nodes`. Without a login this fails, and the JSON tab stays active (`AddValidatorControls.tsx:50-85`). That is expected.
  - The conversion is permanent.

### 2.9 Initialize Validator Set (C-Chain; the Primary Network signs)

- Route: `/console/create-l1/init-validator-set`. Tool title 'Initialize Validator Set'.
- The page fills the subnet field (label 'L1 Subnet ID' not tied; `placeholder 'Enter subnet ID'`) from the store, and 'Conversion Tx ID (P-Chain)' (`placeholder 'txID...'`) from Glacier or, before Glacier has it, from the store (`validator-manager-setup/InitValidatorSet.tsx:172-223, 437-453`).
- Controls:
  1. `button 'Aggregate Signatures'` (`:487-495`). Needs a conversion tx ID. Busy name 'Loading...'.
  2. Wait for 'Signature aggregated' (`:466-476`).
  3. `button 'Initialize Validator Set'` (`:561-569`). Busy name 'Loading...'.
- Success: 'Validator set initialized' (`:552-556`).
- Error: a red box under the second card (`:580-585`). Mapped texts come from `parseAggregationError` and `parseInitValidatorSetError`.
- Chain check: `managerIsValidatorSetInitialized(proxy)` is true. `managerTotalWeight(proxy)` is 100. `managerNodeValidationId(proxy, v0.nodeID)` equals `initialValidationId(subnetId, 0)` as hex. `managerValidator(...).status` is `ValidatorStatus.Active`.
- Gotchas:
  - Retry: reload, 'Aggregate Signatures', then 'Initialize Validator Set' (section 1.9). The reload is safe here.
  - The ProposerVM card stays hidden on the C-Chain (`console/shared/ProposerVMPreflightCard.tsx:42-45`).
  - Do not click 'Finish' unless the test covers the end modal. Closing the modal clears `v4-create-l1-flow` (`app/console/create-l1/[step]/client-page.tsx:43-45`).

### 2.10 Initiate V2 only (carry-over seed for remove-expired, M2)

- Route: `/console/add-validator/select-subnet?subnetId=<subnetId>`. The query sets the subnet when it differs from the store's, which is always the case after a full load because the subnet is not persisted (`app/console/add-validator/[step]/client-page.tsx:15-18`).
- Controls: as 2.11 steps 1 and 2, with V2 and weight 1. Stop at 'Transaction Completed'. Do not open the P-Chain step.
- Chain check: `managerValidator(proxy, validationId)` has status `PendingAdded`. Write the block number and the `registrationExpiry` of the `InitiatedValidatorRegistration` event to the ledger.
- Gotcha: the add-validator store keeps V2. Open the 2.11 URL again with `?subnetId=`; setting the subnet clears V2 (`addValidatorStore.ts:64-75`). With client navigation instead, click `button 'Remove validator'` on the V2 card (`ValidatorItem.tsx:62-72`; the name comes from `title`).

### 2.11 Add validator V1 (C-Chain, P-Chain, C-Chain)

Route: `/console/add-validator/select-subnet?subnetId=<subnetId>`. Steps: `select-subnet`, `initiate-registration`, `pchain-registration`, `complete-registration`, `verify-validator-set` (optional) (`app/console/add-validator/steps.ts`). No tool gate: connect in the header first.

Before you open it: `waitForGlacierSubnet(subnetId, { converted: true })`.

1. Select L1 Subnet
   - Wait for the badge 'PoA · EOA' next to `heading 'Select L1 Subnet'` (`add-validator/steps/SelectSubnetStep.tsx:30-39`; `add-validator/ManagerTypeBadge.tsx:37-39`), and for `button /^Validator Manager Details/` (the name ends with a plus or minus sign) with the row 'Total Validator Weight' 100 (`components/ValidatorManagerDetails.tsx:103-158`).
   - `link 'Next'`.
2. Initiate Validator Registration (C-Chain)
   - `placeholder /"nodePOP"/`, `fill(nodeCredentialsJson(v1))`, `button 'Add Validator'`.
   - Consensus Weight `css: input[type="number"]:not([step]):not([min])`, `fill('10')`. The page refuses 20 % or more of the total weight (`permissioned-l1s/add-validator/InitiateValidatorRegistration.tsx:84-103`).
   - Validator Balance `css: input[type="number"][step="0.000001"]`, `fill('0.02')`.
   - Fill the card before you initiate: each card edit clears the stored tx hash (`addValidatorStore.ts:77-87`).
   - `button 'Initiate Validator Registration'` (`InitiateValidatorRegistration.tsx:350-361`). It shows only after the badge stops 'Detecting…' (`add-validator/steps/InitiateRegistrationStep.tsx:128`). Busy name 'Processing...'.
   - Success: the button name becomes 'Transaction Completed'.
   - Chain check: `managerNodeValidationId(proxy, v1.nodeID)` is not zero. `managerValidator(...)`: status `PendingAdded`, weight 10. The validation ID is topic 1 of the manager's log in the receipt (`:175-187`). Write it to the ledger.
3. P-Chain Registration
   - Ignore 'Insufficient P-Chain balance...' (section 1.11).
   - Wait for the badge 'PoA · EOA' (signing subnet loaded, section 1.9), then for 'Initial Balance:' and the text '0.02 AVAX' (`permissioned-l1s/add-validator/SubmitPChainTxRegisterL1Validator.tsx:238-249`). They show when the page has read the Warp message from the initiate receipt.
   - `button 'Core Sign & Submit to P-Chain'` (`:312-320`). It aggregates, sends the RegisterL1ValidatorTx and waits for it. Busy name 'Core Processing...' until the aggregation ends; then the button is gone.
   - 'Signatures aggregated' shows as soon as the aggregation ends, before the tx goes out (`:148, 294-299`). It is not the success signal.
   - Success: the store has the P-Chain tx ID: `browser.evaluate(() => JSON.parse(localStorage.getItem('v4-add-validator-store-testnet') ?? '{}').state?.pChainTxId ?? '')` is not empty, and the page shows no 'P-Chain transaction failed:' box. The page never shows the tx ID.
   - Chain check: the RegisterL1ValidatorTx from the signer's record gives 'Committed'. `pL1Validator(validationId)` shows weight 10 and a balance near 0.02 AVAX.
   - Retry: remount (section 1.7).
4. Complete Registration (C-Chain)
   - 'P-Chain Transaction ID' (`placeholder 'Enter the P-Chain transaction ID from the previous step'`) is filled from the store (`console/shared/CompletePChainRegistration.tsx:128-133, 388-395`). If it is empty, fill it from the signer's record.
   - Wait for the badge 'PoA · EOA' (`add-validator/steps/CompleteRegistrationStep.tsx:52-55`).
   - `button 'Complete Validator Registration'` (`CompletePChainRegistration.tsx:467-480`). Busy name 'Loading...'.
   - Success: 'Registration completed' and 'Success! Your validator is now registered and active on the L1.' (`:460-464, 495-501`).
   - Chain check: `managerValidator(...).status` is `Active`. `managerTotalWeight` grew by 10.

### 2.12 Change weight of V1 (10 to 12)

Route: `/console/permissioned-l1s/change-validator-weight/select-subnet`. This flow takes no `subnetId` query. Steps: `select-subnet`, `initiate-weight-change`, `pchain-weight-update`, `complete-weight-change`, `verify-validator-set` (optional). The steps show no type badge.

Before you open it: `glacierL1Validators(subnetId, { includeInactive: true })` lists V1.

1. Select L1 Subnet: label 'Subnet ID' is not tied. `placeholder 'Enter subnet ID'`, `fill(subnetId)` (`permissioned-l1s/change-weight/steps/SelectSubnetStep.tsx:21-26`). Wait for `button /^Validator Manager Details/` (the name ends with a plus or minus sign) and its row 'Signing Subnet ID' with `11111111111111111111111111111111LpoYY` (`ValidatorManagerDetails.tsx:147-149`). `link 'Next'`.
2. Initiate Weight Change
   - Validation ID: wait for the suggestion `screen.getByText(v1.nodeID)`, then click it (`components/Input.tsx:151-171`; suggestions are `div` elements with no role). Do not wait on the placeholder: it reads 'Enter validation ID in HEX format' on the first render, before the load starts, and again after a failed load (`SelectValidationID.tsx:78, 119-123, 300`).
   - `textbox 'New Weight'` (label tied by id `weight`), `fill('12')` (`permissioned-l1s/change-weight/InitiateChangeWeight.tsx:201-210`).
   - `button 'Initiate Change Weight'` (`:244-258`). Disabled until the selection has a NodeID. Busy name 'Processing...'.
   - Success: 'Transaction Completed'.
   - Chain check: `managerValidator(...)`: weight 12, `sentNonce` > `receivedNonce`.
3. P-Chain Weight Update
   - `button 'Aggregate Signatures'`. Busy name 'Loading...'. Wait for 'Signatures aggregated'. Then `button 'Core Submit to P-Chain'`; busy name 'Core Submitting to P-Chain…' (`console/shared/SubmitPChainTxWeightUpdate.tsx:400-446`).
   - Success: 'P-Chain tx confirmed:' with the tx ID (`:424-433`).
   - Chain check: `pL1Validator(validationId)` shows weight 12.
4. Complete Weight Change
   - `button 'Complete Weight Change'` (`console/shared/CompletePChainWeightUpdate.tsx:480-493`). Busy name 'Loading...'.
   - Success: 'Success! The validator weight has been updated successfully.' (`:510-518`).
   - Chain check: `managerValidator(...)`: `receivedNonce` equals `sentNonce`, weight 12.
   - Signing subnet: the step aggregates with `signingSubnetId || subnetIdL1` (`console/shared/CompletePChainWeightUpdate.tsx:235`), so a click before the manager details load asks the mock validators, which never sign. This step and the P-Chain step show no badge. The test starts `browser.waitForResponse` for Glacier's record of the manager's chain (`/v1/networks/testnet/blockchains/yH8D7ThNJkxmtkuv2jgBa4P1Rn3Qpr4pPr7QYNfcdoS6k6HWp`, `coreViem/utils/glacier.ts:49`) before 'Next', and waits for it. That request ends the details load (`hooks/useVMCAddress.ts:128-147`). UX finding 37.

Gotchas:

- A Validation ID typed or pasted before the list loads keeps an empty NodeID, and the button stays disabled with no message (`SelectValidationID.tsx:277-290`). Always click the suggestion.
- The P-Chain step takes the signing subnet only from the manager details. While they load, a click shows an error box that starts with 'Signing subnet ID not available.' (`SubmitPChainTxWeightUpdate.tsx:199-205`). Wait for the 'Signing Subnet ID' row, then click again.

### 2.13 Balance top-up of V0 (+0.01 AVAX)

- Route: `/console/layer-1/l1-validator-balance`. Tool title 'Validator Balance Increase'.
- Before you open it: `glacierL1Validators(subnetId, { includeInactive: true })` lists V0.
- Controls:
  1. `placeholder 'Enter subnet ID'`, `fill(subnetId)` (`layer-1/BalanceTopup.tsx:250-255`).
  2. Validation ID (CB58 here): wait for the suggestion `screen.getByText(v0.nodeID)`, click it (`:263-269`).
  3. Amount: label 'Amount' not tied. `placeholder '0.0'` (`:281-298`), `fill('0.01')`.
  4. `button 'Core Increase Balance'` (`:339-348`). Disabled while the amount is above the P-Chain balance (`:165-166`). Busy name 'Core Increasing Balance...'.
- Success: `heading 'Balance Increased Successfully'` (h3) and 'Added 0.01 AVAX to validator balance' (`:171-188`).
- Chain check: `pL1Validator(v0ValidationId).balance` grew by about 0.01 AVAX. The balance falls by 512 nAVAX each second (about 31,000 nAVAX per minute), so compare with a margin.
- Gotcha: errors that contain 'balance' show nowhere, and errors that contain 'amount' show only as a red border (`:293, 327-331`). A failed tx can show nothing. The chain check is the only proof.

### 2.14 Remove validator V1

Route: `/console/remove-validator/select-subnet?subnetId=<subnetId>` (`app/console/remove-validator/[step]/client-page.tsx:55-58`). For PoA the flow drops 'Claim Delegation Fees' once the type is known (`:30-38`). Steps: `select-subnet`, `initiate-removal`, `pchain-removal`, `complete-removal`, `verify-validator-set` (optional).

1. Select L1 Subnet: wait for the badge 'PoA · EOA'. `link 'Next'`.
2. Initiate Removal
   - Validation ID (HEX): wait for `screen.getByText(v1.nodeID)`, click it (`permissioned-l1s/remove-validator/InitiateValidatorRemoval.tsx:209-218`).
   - `button 'Initiate Validator Removal'` (`:251-265`). Busy name 'Processing...'.
   - Success: 'Transaction Completed'.
   - Chain check: `managerValidator(...).status` is `PendingRemoved`.
3. P-Chain Weight Update
   - Ignore 'Insufficient P-Chain balance...' (section 1.11). Wait for the badge 'PoA · EOA' (`remove-validator/steps/PChainRemovalStep.tsx:41-44`).
   - `button 'Aggregate Signatures'`, then `button 'Core Submit to P-Chain'` (shared component, 2.12 step 3).
   - Success: 'P-Chain tx confirmed:'.
   - Chain check: `pL1Validator(v1ValidationId)` returns null (the P-Chain removed the validator). The remaining balance goes back to the wallet's P address.
4. Complete Removal
   - 'P-Chain SetL1ValidatorWeightTx ID' is filled from the store.
   - `button 'Sign & Complete Validator Removal'` (`permissioned-l1s/remove-validator/CompleteValidatorRemoval.tsx:369-389`). Busy name 'Loading...'.
   - Success: 'Validator removal completed' (`:357-361`).
   - Chain check: `managerValidator(...).status` is `Completed`. `managerTotalWeight` fell by 12.

Gotcha: if a removal went out earlier and the P-Chain step failed, the initiate step shows a resend card with `button 'Resend Removal Message'`, because the validator is `PendingRemoved` with `sentNonce` > `receivedNonce` (`remove-validator/steps/InitiateRemovalStep.tsx:71-114`; `remove-validator/ResendRemovalMessage.tsx:112-122`). Click it, then 'Next'.

### 2.15 Remove expired registration (carry-over, M2)

- Route: `/console/permissioned-l1s/remove-expired-validator-registration`. Tool title 'Remove Expired Validator Registration'.
- Controls: the subnet field (`placeholder 'Enter subnet ID'`; it starts with the create store's subnet, `:66`, so fill the old L1's subnet), then 'From Block' (no tied label): `placeholder 'Enter block number or leave blank'`, `fill(<ledger block number>)`. Then `button 'Search for Expired Registrations'`. Then, on the card that shows V2's validation ID (hex), `button 'Remove'` (`permissioned-l1s/remove-expired-registration/RemoveExpiredValidatorRegistration.tsx:513-549, 590-625`). Scope the card with `filter({ hasText: v2ValidationIdHex })`.
- Success: 'Removal Successful' on that card (`:674`).
- Chain check: `managerValidator(v2ValidationId).status` is `Invalidated`.
- Gotcha: always fill 'From Block'. Blank starts at block 0 (`:194`), although the label says 'defaults to last 100k blocks' (`:515`). From block 0 the page sends one `eth_getLogs` per 2,000 blocks for the whole Fuji C-Chain.

### 2.16 Disable V0 (teardown, P-Chain)

- Route: `/console/permissioned-l1s/disable-validator`. Tool title 'Disable L1 Validator'.
- Before you open it: `glacierL1Validators(subnetId)` lists V0 as active.
- Controls:
  1. `placeholder 'Enter subnet ID'`, `fill(subnetId)` (`permissioned-l1s/disable-validator/DisableValidator.tsx:270-278`). Use `fill`: each change of the field loads the list again (`ValidatorSelector.tsx:77-85`).
  2. The list loads by itself. `button 'Refresh'` loads it again (`ValidatorSelector.tsx:102-110`). Pick V0: `button new RegExp('^' + v0.nodeID)` (`:168-207`).
  3. Wait for 'Your wallet is authorized to disable this validator.' (`DisableValidator.tsx:338-342`).
  4. `checkbox /^I understand this disables/` (the checkbox sits inside its label, `:375-389`), `check()`.
  5. `button 'Core Disable Validator'` (`:392-404`). Busy name 'Core Disabling Validator...'.
- Success: `heading 'Validator Disabled'` (h4, `:198-199`).
- Chain check: `pL1Validator(v0ValidationId).balance` is 0. The wallet's P balance grew by the refund.
- Gotchas:
  - The page computes `disableAuth` from Glacier's deactivation owner list (`:115-145, 159-162`). The SDK does not pass the owners to the wallet, so the signer reads them from `platform.getL1Validator`.
  - The list hides validators with weight 0 and inactive validators (`ValidatorSelector.tsx:35-51`).
  - The success link goes to the legacy explorer (section 4, C).

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

Each item names the file and line in this worktree (paths under `components/toolbox` unless the path says otherwise). Severity: A = blocks or misleads a user, B = accessibility, C = text or consistency.

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
12. Validator flows lose the subnet on reload. `stores/addValidatorStore.ts:105-108`, `stores/changeWeightStore.ts:73-76` and `stores/removeValidatorStore.ts:66-69` do not persist `subnetIdL1`, so a reload on any later step shows 'Please select an L1 subnet first.' With `?subnetId=` in the URL, the page sets the subnet again and that clears the tx hash, the validator balance and the proof of possession (`app/console/add-validator/[step]/client-page.tsx:15-18`; `stores/addValidatorStore.ts:64-75`). On the P-Chain Registration step 'Sign & Submit to P-Chain' then cannot run: the balance and the proof are gone and the page has no field for them.
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
