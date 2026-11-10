---
name: studio-frontend
description: Build the end-user app for a Studio project as a React app under frontend/, designed around what its users come to do (tip a creator, pay at checkout, bridge USDC), backed by the deployed contracts through the @studio/react hooks, and runnable in the Studio Preview tab and as an exported Next.js project. Use when the builder asks for a UI, a frontend, an app, a demo page or a way for people to use their contracts.
---

# Building a Studio frontend

A Studio frontend is the app the builder's **end users** open: fans, buyers, depositors, players. It is not a contract console for the builder. The Contracts tab already gives the builder every function.

It is a **React app** in `frontend/`. The **Preview** tab compiles and runs it in a sandboxed frame, using the connected wallet, and **Export** turns the same files into a Next.js project the builder can deploy anywhere. You write plain React (function components, hooks, JSX); there is no build step to configure.

## Start from the end user, not the ABI

1. **Understand the need.**
   - Read `docs/BRIEF.md` if the project has one, the blueprint's GUIDE (`read_blueprint`), and what the builder said in the chat.
   - Write down, for yourself:
     - **Who** opens the page, which is not the builder.
     - **The one to three jobs** they come to do.
     - **What they need to see** to trust it: balances, prices, who they're paying, what happens next.
     - **What "done" looks like** to them.
2. **Ask when it matters.** If the audience or the main job is unclear, ask the builder one short question before building. For example: "Who opens this page: fans tipping creators, or creators setting up their profile?" Otherwise, state your assumption in your reply and build for it.
3. **Map jobs to the contracts.**
   - Call `frontend_context` for the deployed contracts. They decide what is possible; the user's jobs decide the screens.
   - If a job needs something the contracts don't do, don't fake it in the UI. Tell the builder, and propose the contract change.
   - If nothing is deployed yet, build against the ABIs in the build, with an empty state until `useContract(name)` returns the deployed contract.
4. **Design each job as a flow in plain language.**
   - For creator tips, the flow is: find a creator, see their profile and what they've received, pick an amount (1, 5 or 10 USDC, or custom), add a message, tip, and see the tip in their recent tips.
   - The flow is not a form titled `tip(handle, amount, message)`.

## End-user rules

- **Speak the user's language.**
  - No function names, `nonpayable`, selectors, raw wei or ABI types anywhere in the UI.
  - Show people and things by their names: handles, product names, token symbols. Addresses are secondary, shortened, and linked to the explorer.
  - Buttons say the outcome: "Tip 5 USDC", "Pay 12.00 USDC", "Bridge to Moon Chain".
- **Fold the mechanics into the flow.**
  - An ERC-20 spend is two visible steps, "1 of 2: allow USDC", then "2 of 2: pay". Approve the exact amount, never unlimited. Skip the first step when the allowance already covers it.
  - Switch the wallet to the right chain for the user, with one sentence on why.
  - Explain waiting in human terms, for example "Confirming on Avalanche, usually a couple of seconds", and for cross-chain steps, "Arriving on Moon Chain in about a minute".
- **Onboard a newcomer.**
  - Say what the app does in one sentence at the top.
  - Offer "Connect wallet" only when an action needs it. Browsing and reading work without a wallet.
  - On the wrong network, show one button to switch.
  - When the user holds none of the token they need, say so, and link the Builder Hub faucet for testnet tokens (`https://build.avax.network/console/primary-network/faucet`).
- **Design every state.**
  - First use: "No tips yet. Be the first to support @alice."
  - Loading: skeletons, not blank values.
  - Success: what changed, for example "@alice received 5 USDC. View transaction".
  - Failure: in words, with what to do next.
- **Show what the user cares about.** Their balance next to the amount field, with a Max button. Their own history, filtered to their address. Totals and progress that give the page meaning, such as total tipped or items sold.
- **One main job per screen.** Use `.bh-tabs` for two or three jobs; the most common job comes first and is open by default.
- **Leave admin out.**
  - Owner and role functions (withdraw, pause, set fees, allowlists) aren't for end users, and the builder runs them from the Contracts tab.
  - Only add an owner area when the builder asks. Show it only to the owner account, below the user flows.
- **Keep the contract rules.** Never invent a feature the contracts don't have, and never hide a required step or a fee.

**Examples of the shift:**

| Contract view (don't) | End-user view (do) |
| --- | --- |
| `register(handle, displayName, bio, avatarURI)` form | "Create your creator page": handle with a live availability check, name, bio, a preview of the page |
| `approve` + `pay(productId, quantity)` | Product card, quantity stepper, "Pay 24.00 USDC", a two-step progress bar, a receipt |
| `sendToL1(amount, recipient)` | "Bring USDC from Base to Moon Chain": amount, your balance on Base, arrival estimate, and a status through Sent, In transit and Arrived |
| `balanceOf`, `totalSupply` reads | "You hold 1,250 MOON (0.4% of supply)" |

## Files

| File | What goes in it |
| --- | --- |
| `frontend/App.jsx` | **Required.** The root component, `export default function App() { ... }`. Studio mounts it; don't call `createRoot` yourself. |
| `frontend/components/*.jsx` | Components, one per file. Split by screen or by piece of UI, not by size. |
| `frontend/styles.css` | Optional. Only what the app adds on top of the design system, using the `--bh-*` variables. |

**Look:** load the `design-system` skill and build with its `bh-*` classes, written as `className` in JSX. Studio adds `builder-hub.css` for you; don't write that file.

**Footer:** every Studio-built app ends with "Built on Builder Hub Studio · Powered by Avalanche", added by the Preview and by the export. Don't write your own and don't hide it; leave room for it under your content.

### Imports

An app may import exactly these, and its own files:

- `react`, `react-dom/client`: React 19. Hooks, context, `useReducer`, `useMemo` and the rest.
- `viem`, and `viem/chains`: for units and encoding (`formatUnits`, `parseUnits`, `isAddress`, `keccak256`, ...).
- `@studio/react`: the hooks below.
- Your own files, **with the file extension**: `import Card from './components/Card.jsx'`.

No other packages: no UI kits, no router, no state libraries, no TypeScript. Keep state in React (`useState`, `useReducer`, context); `localStorage` and cookies don't work in the sandbox. No images as files: use inline SVG in JSX or emoji-free text. Put every screen behind `App` with state (`useState('tip')`) or `.bh-tabs`, not a router.

## `@studio/react`

```jsx
import { useWallet, useRead, useWrite, useContract, useTokens, useTokenBalances, useEERC, explainError } from '@studio/react';
import { formatUnits, parseUnits } from 'viem';
```

| Hook | What it gives you |
| --- | --- |
| `useWallet()` | `{ address, chainId, isConnected, connecting, error, connect(), switchChain(id) }`. `connect()` opens the wallet picker. Browsing needs no wallet; call it from the button that needs one. |
| `useContract('Name')` | `{ name, address, abi, chainId, network, explorerUrl }` for a deployed contract, or `null` if it isn't deployed. Use `null` to show a "not deployed yet" state. |
| `useRead('Name', 'fn', [args], { refresh, enabled })` | `{ data, error, loading, refetch }`. `refresh` is a number of milliseconds for live values. `enabled: false` waits (for example until a handle is typed). Works before any wallet connects. `bigint` results come back as `bigint`. |
| `useWrite('Name', 'fn')` | `{ write(args, { value }), status, hash, receipt, error, explorerUrl, busy, reset }`. `write` connects the wallet, switches to the contract's chain, sends, and follows the transaction. `status` is `idle`, `wallet`, `pending`, `confirmed` or `failed`. |
| `useTokens(chainId)` | The known tokens on a chain: `[{ address, symbol, name, decimals, logoURI }]`. Use it for token pickers and labels. |
| `useTokenBalances(chainId, { refresh })` | `{ balances, error, loading, refetch }` for the connected wallet: `[{ symbol, decimals, balance, formatted }]`. `formatted` is ready to show. |
| `useEERC('Name', { token })` | A private (Encrypted ERC) token: `{ status, balance, register(), unlock(), refresh(), deposit(amount), transfer(to, amount), withdraw(amount), mint(to, amount), isRegistered(addr), busy, stage, stageText, error, lastTx }`. Load the `eerc` skill before using it; it has the screens to start from. |
| `explainError(e)` | An error in words: a rejected request, a contract's own revert reason, or the wallet's message. |

Rules for using them:

- **Never hardcode addresses or ABIs.** Contracts come from `useContract` / `useRead` / `useWrite` by name. Names are the contract names in `frontend_context`.
- **Reads first.** Render from `useRead`, with a skeleton (`.bh-skeleton`) while `data` is `undefined`. After a confirmed write, call the read's `refetch()` (or pass `refresh`) so the screen shows what changed.
- **Write states are the UI.** Map `status` to text on the button and under it: `wallet` is "Confirm in your wallet…", `pending` is "Confirming…" with the `explorerUrl` link, `confirmed` is what changed for the user, `failed` is `error`. Disable the button while `busy`.
- **Units.** Amounts are `bigint` in base units. Use `parseUnits(text, decimals)` going in and `formatUnits(value, decimals)` coming out, with `decimals` read from the token (`useRead('Token', 'decimals')`). Payable values are in the chain's native coin. Never show raw wei.
- **ERC-20 spends** are two writes: `useWrite('USDC', 'approve')` for exactly the amount, then the action. Check `useRead('USDC', 'allowance', [address, spender], { enabled: isConnected })` and skip the approval when it already covers the amount.
- **Events and lists** (recent tips, activity): if the contract has a view that lists (`latest(0, 20)`), use it with `useRead`. Otherwise read events with viem from the same client: `import { publicClientFor } from '@studio/react'` then `publicClientFor(chainId).getLogs({ address, event, fromBlock })`, limited to the last few hundred blocks.
- **Everything happens in the app.** The app is the product: never link users to Builder Hub, its console or its tools (`build.avax.network/console/...`, "use the eERC console", "open the faucet in Builder Hub") to finish something the app is for. Registering a private account, depositing, sending, withdrawing, minting and reading a private balance are screens in this app, built with `useEERC`. Links out are only for reading more (an explorer link for a transaction, docs).
- **Safety.** React escapes text, so render chain data and user input as children, never with `dangerouslySetInnerHTML`. No private keys, seed phrases or secrets anywhere.
- **Other chains than the contract's** (for example a bridge showing a balance on two chains): `useTokenBalances(otherChainId)` and `publicClientFor(otherChainId)` work for any chain Studio knows, meaning chains your contracts are deployed to and registry chains.

## Skeleton

`frontend/App.jsx`:

```jsx
import { useContract, useRead, useWallet } from '@studio/react';
import TipBox from './components/TipBox.jsx';

export default function App() {
  const tips = useContract('CreatorTips');
  const wallet = useWallet();
  const { data: creator } = useRead('CreatorTips', 'creatorOf', ['alice'], { refresh: 15000, enabled: !!tips });

  if (!tips) return <main className="bh-page"><p className="bh-notice bh-notice--warn">This app isn't live yet. Deploy CreatorTips, then reload.</p></main>;

  return (
    <main className="bh-page">
      <header className="bh-topbar">
        <h1 className="bh-title">Support a creator</h1>
        <span className="bh-spacer" />
        {wallet.isConnected ? (
          <span className="bh-hash">{wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}</span>
        ) : (
          <button className="bh-btn" onClick={wallet.connect} disabled={wallet.connecting}>Connect wallet</button>
        )}
      </header>
      <p className="bh-body">
        {creator === undefined ? <span className="bh-skeleton" /> : /^0x0+$/.test(creator) ? '@alice has not claimed a page yet.' : '@alice is accepting tips.'}
      </p>
      <TipBox />
    </main>
  );
}
```

`frontend/components/TipBox.jsx`:

```jsx
import { useState } from 'react';
import { parseUnits } from 'viem';
import { useContract, useWrite } from '@studio/react';

export default function TipBox() {
  const tips = useContract('CreatorTips');
  const [amount, setAmount] = useState('5');
  const approve = useWrite('USDC', 'approve');
  const tip = useWrite('CreatorTips', 'tip');
  const busy = approve.busy || tip.busy;

  async function send() {
    const value = parseUnits(amount || '0', 6);
    // (A real app reads the allowance first and skips this step when it is already enough.)
    const allowed = await approve.write([tips.address, value]);
    if (allowed) await tip.write(['alice', value, '']);
  }

  return (
    <section className="bh-section">
      <h2 className="bh-section-header">Tip @alice</h2>
      <input className="bh-input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      <button className="bh-btn" onClick={send} disabled={busy}>
        {approve.status === 'wallet' ? 'Confirm in your wallet…' : tip.status === 'pending' ? 'Confirming…' : `Tip ${amount} USDC`}
      </button>
      {tip.status === 'confirmed' && <p className="bh-notice bh-notice--good">@alice received {amount} USDC.</p>}
      {(approve.error || tip.error) && <p className="bh-notice bh-notice--bad">{approve.error || tip.error}</p>}
    </section>
  );
}
```

## Finish

- After writing the files, tell the builder to open the **Preview** tab.
- Describe the app as the end user experiences it: who it's for and the flows it offers. Don't list the hooks or functions it calls.
- Name any assumption you made about the audience.
- Name any user need the contracts can't meet yet, with the contract change that would unlock it.
- If a contract the app needs isn't deployed yet, name the deployment to run first.
- Tell the builder that **Export** turns this into a Next.js project with the same React files, wagmi and RainbowKit, ready to deploy.
- Iterate on what the builder reports. The Preview tab shows errors from the app, including compile errors in a `.jsx` file, and the builder can paste them to you.
- A project with an older `frontend/index.html` keeps working. Only rewrite it as React when the builder asks.
