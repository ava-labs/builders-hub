---
name: eerc-frontend
description: Screens for an Encrypted ERC (eERC) token in a Studio app, with the useEERC hook from @studio/react - private account, balance, deposit, send, withdraw and the owner's mint. Use with the frontend and design-system skills whenever the project has an EncryptedERC contract.
---

# Encrypted ERC screens

Everything a holder does with a private token happens inside the app. Never send users to Builder Hub, its console or its eERC tools to register, deposit, send, withdraw, mint or see their balance, and don't mention them. `useEERC` does all of it in the app.

```jsx
import { useEERC } from '@studio/react';
const eerc = useEERC('EncryptedERC');                     // standalone token
const eerc = useEERC('EncryptedERC', { token: usdc });    // converter: the ERC-20 it wraps
```

| Field | Meaning |
| --- | --- |
| `status` | `null` until a wallet connects, then `{ registered, unlocked, isConverter, decimals, isOwner, auditorSet, tokens }`. `unlocked` means the balance can be shown without asking for a signature. |
| `balance` | `{ cents, formatted }` once unlocked (`formatted` is "12.34"), else `null`. |
| `register()` | Creates the private account: one free signature, then a proof and one transaction. |
| `unlock()` | Shows the balance on a new device or browser: one free signature, no transaction. |
| `refresh()` | Re-reads status and balance without prompting. |
| `deposit(amount)` | Converter only. Approves the ERC-20 when needed, then deposits. `amount` like "25.50" in the token's units. Amounts below 0.01 are returned as dust. |
| `transfer(to, amount)` | Private send to a registered address, in eERC units (2 decimals). |
| `withdraw(amount)` | Converter only: back to the public ERC-20. |
| `mint(to, amount)` | Standalone token, owner only. |
| `isRegistered(address)` | Checks a recipient before sending. |
| `busy`, `stage`, `stageText` | The action running (`'register'`, `'deposit'`, ...), its stage (`signature`, `proof`, `transaction`, `confirming`) and a sentence for it. Show `stageText` under the button while `busy`. |
| `error`, `lastTx` | The last error in words, and the last transaction hash. |

Each action returns `null` when it fails or the user cancels, so `if (await eerc.transfer(to, amount))` means it went through.

## Rules

- **Say what's private.** Amounts and balances are private. Who deposits, withdraws and sends is public, and the auditor (when `auditorSet`) can read amounts. Say this once, near the balance.
- **First visit:** show "Create your private account" until `status.registered`. Explain the signature as the key that unlocks the balance. It's free and the same every time for this wallet.
- **Returning on a new device:** when `registered && !unlocked`, show "Unlock balance" (`unlock()`) instead of the number.
- **Proofs take a few seconds.** Keep the button disabled while `busy`, show `stageText`, and don't let the user start a second action.
- **Recipients:** check `isRegistered(to)` before `transfer`. If false, say they need to open this app and create their private account first.
- **Amounts:** eERC has 2 decimals; inputs accept up to 2 for send, withdraw and mint. Show balances with `balance.formatted` and the token symbol.
- **Owner area:** render mint only when `status.isOwner`; everyone else never sees it.
- **Converter mode:** the ERC-20 comes from `useTokens(chainId)` by symbol (for example USDC), or `status.tokens`. Show the public ERC-20 balance next to the deposit form with `useTokenBalances(chainId)`.

## Templates

Start from these files and adapt the words to the brief. They use only `@studio/react`, `react` and the design-system classes.

`frontend/App.jsx`:

```jsx
import { useState } from 'react';
import { useContract, useEERC, useTokens } from '@studio/react';
import PrivateAccount from './components/PrivateAccount.jsx';
import Balance from './components/Balance.jsx';
import Deposit from './components/Deposit.jsx';
import Send from './components/Send.jsx';
import Withdraw from './components/Withdraw.jsx';
import Mint from './components/Mint.jsx';

export default function App() {
  const token = useContract('EncryptedERC');
  const tokens = useTokens(token?.chainId ?? null);
  // Converter apps wrap one ERC-20; a standalone token passes nothing.
  const usdc = tokens.find((t) => t.symbol === 'USDC')?.address;
  const eerc = useEERC('EncryptedERC', { token: usdc });
  const [tab, setTab] = useState('balance');

  if (!token) return <main className="bh-page"><p className="bh-notice bh-notice--warn">This app isn't live yet.</p></main>;

  const s = eerc.status;
  const tabs = [
    ['balance', 'Balance'],
    ...(s?.isConverter ? [['deposit', 'Deposit']] : []),
    ['send', 'Send'],
    ...(s?.isConverter ? [['withdraw', 'Withdraw']] : []),
    ...(s?.isOwner && !s.isConverter ? [['mint', 'Mint']] : []),
  ];

  return (
    <main className="bh-page">
      <header className="bh-topbar">
        <h1 className="bh-title">Private balance</h1>
        <span className="bh-pill bh-pill--info">{token.network}</span>
        <span className="bh-spacer" />
        {eerc.wallet.isConnected ? (
          <span className="bh-hash">{eerc.wallet.address.slice(0, 6)}…{eerc.wallet.address.slice(-4)}</span>
        ) : (
          <button className="bh-btn" onClick={eerc.wallet.connect} disabled={eerc.wallet.connecting}>Connect wallet</button>
        )}
      </header>

      {!eerc.wallet.isConnected ? (
        <p className="bh-body">Connect a wallet to see your private balance.</p>
      ) : !s ? (
        <span className="bh-skeleton" />
      ) : !s.registered ? (
        <PrivateAccount eerc={eerc} />
      ) : (
        <>
          <nav className="bh-tabs">
            {tabs.map(([id, label]) => (
              <button key={id} className="bh-tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </nav>
          {tab === 'balance' && <Balance eerc={eerc} symbol={usdc ? 'USDC' : ''} />}
          {tab === 'deposit' && <Deposit eerc={eerc} token={usdc} chainId={token.chainId} />}
          {tab === 'send' && <Send eerc={eerc} />}
          {tab === 'withdraw' && <Withdraw eerc={eerc} />}
          {tab === 'mint' && <Mint eerc={eerc} />}
        </>
      )}
    </main>
  );
}
```

`frontend/components/Progress.jsx`, shared by every form:

```jsx
export default function Progress({ eerc, done }) {
  if (eerc.busy) return <p className="bh-hint"><span className="bh-spinner" /> {eerc.stageText ?? 'Working…'}</p>;
  if (eerc.error) return <p className="bh-notice bh-notice--bad">{eerc.error}</p>;
  if (done) return <p className="bh-notice bh-notice--good">{done}</p>;
  return null;
}
```

`frontend/components/PrivateAccount.jsx`:

```jsx
import Progress from './Progress.jsx';

export default function PrivateAccount({ eerc }) {
  return (
    <section className="bh-section">
      <h2 className="bh-section-header">Create your private account</h2>
      <p className="bh-body">
        Your balance is encrypted so only you can read it. Your wallet signs a message once to create the key that
        unlocks it. The signature is free, and it's the same every time for this wallet.
      </p>
      <button className="bh-btn" onClick={eerc.register} disabled={!!eerc.busy}>Create private account</button>
      <Progress eerc={eerc} />
    </section>
  );
}
```

`frontend/components/Balance.jsx`:

```jsx
import Progress from './Progress.jsx';

export default function Balance({ eerc, symbol }) {
  const s = eerc.status;
  return (
    <section className="bh-section">
      <div className="bh-stats">
        <div className="bh-stat">
          <span className="bh-label">Private balance</span>
          {eerc.balance ? (
            <span className="bh-fig">{eerc.balance.formatted}<span className="bh-unit">{symbol}</span></span>
          ) : (
            <button className="bh-btn bh-btn--secondary" onClick={eerc.unlock} disabled={!!eerc.busy}>Unlock balance</button>
          )}
        </div>
      </div>
      <p className="bh-hint">
        Only you can see this amount{s?.auditorSet ? ', and the auditor this token names' : ''}. Who sends and receives is public.
      </p>
      <Progress eerc={eerc} />
    </section>
  );
}
```

`frontend/components/Deposit.jsx` (converter):

```jsx
import { useState } from 'react';
import { useTokenBalances } from '@studio/react';
import Progress from './Progress.jsx';

export default function Deposit({ eerc, token, chainId }) {
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState(null);
  const { balances } = useTokenBalances(chainId);
  const usdc = balances.find((b) => b.address.toLowerCase() === token?.toLowerCase());

  async function submit(e) {
    e.preventDefault();
    setDone(null);
    if (await eerc.deposit(amount)) {
      setDone(`${amount} USDC is now in your private balance.`);
      setAmount('');
    }
  }

  return (
    <form className="bh-form" onSubmit={submit}>
      <label className="bh-field">
        <span className="bh-label">Amount to make private</span>
        <input className="bh-input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="25.00" required />
        <span className="bh-hint">Wallet balance: {usdc ? `${usdc.formatted} USDC` : '—'}. Anything below 0.01 is returned.</span>
      </label>
      <button className="bh-btn" disabled={!!eerc.busy || !amount}>Deposit</button>
      <Progress eerc={eerc} done={done} />
    </form>
  );
}
```

`frontend/components/Send.jsx`:

```jsx
import { useState } from 'react';
import Progress from './Progress.jsx';

export default function Send({ eerc }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState(null);
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setDone(null);
    setNote(null);
    if (!(await eerc.isRegistered(to))) {
      setNote("This address hasn't created a private account yet. Ask them to open this app and create one first.");
      return;
    }
    if (await eerc.transfer(to, amount)) {
      setDone(`Sent ${amount} privately.`);
      setAmount('');
    }
  }

  return (
    <form className="bh-form" onSubmit={submit}>
      <label className="bh-field">
        <span className="bh-label">Recipient</span>
        <input className="bh-input" value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" required />
      </label>
      <label className="bh-field">
        <span className="bh-label">Amount</span>
        <input className="bh-input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10.00" required />
        <span className="bh-hint">Available: {eerc.balance?.formatted ?? 'unlock your balance to see it'}</span>
      </label>
      <button className="bh-btn" disabled={!!eerc.busy || !to || !amount}>Send privately</button>
      {note && <p className="bh-notice bh-notice--warn">{note}</p>}
      <Progress eerc={eerc} done={done} />
    </form>
  );
}
```

`frontend/components/Withdraw.jsx` (converter):

```jsx
import { useState } from 'react';
import Progress from './Progress.jsx';

export default function Withdraw({ eerc }) {
  const [amount, setAmount] = useState('');
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setDone(null);
    if (await eerc.withdraw(amount)) {
      setDone(`${amount} USDC is back in your wallet.`);
      setAmount('');
    }
  }

  return (
    <form className="bh-form" onSubmit={submit}>
      <label className="bh-field">
        <span className="bh-label">Amount to withdraw</span>
        <input className="bh-input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="10.00" required />
        <span className="bh-hint">The withdrawn amount is public once it leaves your private balance.</span>
      </label>
      <button className="bh-btn" disabled={!!eerc.busy || !amount}>Withdraw</button>
      <Progress eerc={eerc} done={done} />
    </form>
  );
}
```

`frontend/components/Mint.jsx` (standalone token, owner only):

```jsx
import { useState } from 'react';
import Progress from './Progress.jsx';

export default function Mint({ eerc }) {
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [warning, setWarning] = useState(null);
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setDone(null);
    setWarning(null);
    if (!(await eerc.isRegistered(to))) {
      setWarning("That member hasn't created a private account yet.");
      return;
    }
    if (await eerc.mint(to, amount)) setDone(`Minted ${amount} privately to ${to.slice(0, 6)}…${to.slice(-4)}.`);
  }

  return (
    <form className="bh-form" onSubmit={submit}>
      <label className="bh-field">
        <span className="bh-label">Member</span>
        <input className="bh-input" value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" required />
      </label>
      <label className="bh-field">
        <span className="bh-label">Amount</span>
        <input className="bh-input" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="100.00" required />
      </label>
      <button className="bh-btn" disabled={!!eerc.busy || !to || !amount}>Mint privately</button>
      {warning && <p className="bh-notice bh-notice--warn">{warning}</p>}
      <Progress eerc={eerc} done={done} />
    </form>
  );
}
```
