'use client';

import { useState } from 'react';
import { Copy, Download, Eye, EyeOff } from 'lucide-react';
import type { Hex } from 'viem';
import { MIN_PIN_LENGTH } from '@/lib/console-wallets/crypto';
import {
  changePin,
  createWallet,
  importWallet,
  markBackedUp,
  removeWallet,
  rename,
  reveal,
  unlock,
  type WalletInfo,
} from '@/lib/console-wallets/vault';
import { Button, Field, INPUT, Notice } from '@/components/studio/ui';
import { Dialog } from './Dialog';

export const BROWSER_ONLY =
  "This wallet lives only in this browser. Builder Hub can't recover it. If you clear site data, switch browsers or devices, or forget your PIN without a saved key, you lose access to the wallet and its funds. Save the private key somewhere safe.";
export const BROWSER_ONLY_SHORT = "Browser wallet only. Lost if you don't save the key.";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function BrowserOnlyNotice() {
  return <Notice tone="warn">{BROWSER_ONLY}</Notice>;
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-snug text-zinc-800 dark:text-zinc-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-zinc-900 dark:accent-zinc-100"
      />
      <span>{children}</span>
    </label>
  );
}

function PinInput({
  label,
  value,
  onChange,
  autoFocus,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  hint?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="password"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT}
      />
    </Field>
  );
}

function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, setError };
}

export function UnlockDialog({
  wallet,
  onClose,
  onUnlocked,
}: {
  wallet: WalletInfo;
  onClose: () => void;
  onUnlocked?: () => void;
}) {
  const [pin, setPin] = useState('');
  const action = useAction();
  return (
    <Dialog title={`Unlock ${wallet.label}`} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await unlock(wallet.id, pin);
            onUnlocked?.();
            onClose();
          });
        }}
      >
        <p className="text-[13px] text-zinc-600 dark:text-zinc-400">
          It stays unlocked in this tab and locks again after 15 minutes without use.
        </p>
        <PinInput label="PIN" value={pin} onChange={setPin} autoFocus />
        {action.error && <Notice tone="bad">{action.error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={action.busy} disabled={!pin}>
            Unlock
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** The key with copy and download; the builder confirms they saved it before it counts as backed up. */
function SaveKey({
  wallet,
  privateKey,
  onDone,
  onLater,
}: {
  wallet: Pick<WalletInfo, 'id' | 'label' | 'address'>;
  privateKey: Hex;
  onDone: () => void;
  onLater?: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const action = useAction();
  const download = () => {
    const text = `Console wallet: ${wallet.label}\nAddress: ${wallet.address}\nPrivate key: ${privateKey}\n\nAnyone with this key controls the wallet. Keep it offline and never share it.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-wallet-${wallet.address.slice(2, 8).toLowerCase()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="flex flex-col gap-4">
      <Notice tone="bad">
        Anyone with this key controls the wallet and its funds. Never paste it into a website or share it, including
        with Builder Hub support.
      </Notice>
      <p className="font-mono text-[11.5px] text-zinc-500 dark:text-zinc-400">
        Address <span className="text-zinc-900 dark:text-zinc-50">{wallet.address}</span>
      </p>
      <Field label="Private key">
        <div className="flex gap-2">
          <input
            readOnly
            type={shown ? 'text' : 'password'}
            value={privateKey}
            onFocus={(e) => shown && e.currentTarget.select()}
            className={`${INPUT} flex-1`}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShown((s) => !s)}
            title={shown ? 'Hide' : 'Reveal'}
          >
            {shown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(privateKey).then(() => setCopied(true));
          }}
        >
          <Copy className="h-3.5 w-3.5" /> {copied ? 'Copied' : 'Copy key'}
        </Button>
        <Button type="button" variant="secondary" onClick={download}>
          <Download className="h-3.5 w-3.5" /> Download .txt
        </Button>
      </div>
      <Check checked={saved} onChange={setSaved}>
        I saved my private key somewhere safe. Without it I lose this wallet if this browser&apos;s data is cleared.
      </Check>
      {action.error && <Notice tone="bad">{action.error}</Notice>}
      <div className="flex justify-end gap-2">
        {onLater && (
          <Button type="button" variant="ghost" onClick={onLater}>
            I&apos;ll do it later
          </Button>
        )}
        <Button
          type="button"
          disabled={!saved}
          busy={action.busy}
          onClick={() =>
            void action.run(async () => {
              await markBackedUp(wallet.id);
              onDone();
            })
          }
        >
          Done
        </Button>
      </div>
    </div>
  );
}

export function CreateWalletDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (w: WalletInfo) => void;
}) {
  const [label, setLabel] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [created, setCreated] = useState<{ wallet: WalletInfo; key: Hex } | null>(null);
  const action = useAction();
  const mismatch = again.length > 0 && pin !== again;

  if (created) {
    const finish = () => {
      onCreated?.(created.wallet);
      onClose();
    };
    return (
      <Dialog title="Save your private key" onClose={finish}>
        <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          <span className="font-medium">{created.wallet.label}</span> is ready and unlocked. Save its private key now:
          it is the only way back into this wallet from another browser, or after this one forgets it.
        </p>
        <SaveKey wallet={created.wallet} privateKey={created.key} onDone={finish} onLater={finish} />
      </Dialog>
    );
  }

  return (
    <Dialog title="Create a Console wallet" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin !== again) return action.setError('The PINs don’t match');
          void action.run(async () => {
            const wallet = await createWallet(label, pin);
            const key = await reveal(wallet.id, pin);
            setPin('');
            setAgain('');
            setCreated({ wallet, key });
          });
        }}
      >
        <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          A Console wallet signs for you without a popup for every transaction. Fund it with only what the tools need.
        </p>
        <BrowserOnlyNotice />
        <Field label="Name">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Studio deployer"
            className={INPUT}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <PinInput
            label="PIN"
            value={pin}
            onChange={setPin}
            hint={`At least ${MIN_PIN_LENGTH} characters. Longer is safer.`}
          />
          <PinInput
            label="PIN again"
            value={again}
            onChange={setAgain}
            hint={mismatch ? 'Doesn’t match yet' : undefined}
          />
        </div>
        <Check checked={understood} onChange={setUnderstood}>
          I understand this wallet is only stored in this browser, and Builder Hub can&apos;t recover it.
        </Check>
        {action.error && <Notice tone="bad">{action.error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            busy={action.busy}
            disabled={!understood || pin.length < MIN_PIN_LENGTH || pin !== again}
          >
            Create wallet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ImportWalletDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (w: WalletInfo) => void;
}) {
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const [understood, setUnderstood] = useState(false);
  const action = useAction();

  return (
    <Dialog title="Import a private key" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin !== again) return action.setError('The PINs don’t match');
          void action.run(async () => {
            const wallet = await importWallet(key, label, pin);
            setKey('');
            onCreated?.(wallet);
            onClose();
          });
        }}
      >
        <BrowserOnlyNotice />
        <p className="text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
          The key is encrypted with your PIN and kept in this browser. Keep your own copy: Builder Hub never receives
          it.
        </p>
        <Field label="Private key">
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className={INPUT}
          />
        </Field>
        <Field label="Name">
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <PinInput label="PIN" value={pin} onChange={setPin} hint={`At least ${MIN_PIN_LENGTH} characters`} />
          <PinInput label="PIN again" value={again} onChange={setAgain} />
        </div>
        <Check checked={understood} onChange={setUnderstood}>
          I understand this copy is only stored in this browser, and I keep my own copy of the key.
        </Check>
        {action.error && <Notice tone="bad">{action.error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            busy={action.busy}
            disabled={!understood || !key || pin.length < MIN_PIN_LENGTH || pin !== again}
          >
            Import
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function ShowKeyDialog({ wallet, onClose }: { wallet: WalletInfo; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [key, setKey] = useState<Hex | null>(null);
  const action = useAction();
  return (
    <Dialog title={`Private key · ${wallet.label}`} onClose={onClose}>
      {key ? (
        <SaveKey wallet={wallet} privateKey={key} onDone={onClose} />
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void action.run(async () => {
              setKey(await reveal(wallet.id, pin));
              setPin('');
            });
          }}
        >
          <BrowserOnlyNotice />
          <PinInput label="PIN" value={pin} onChange={setPin} autoFocus hint="Asked every time, even when unlocked" />
          {action.error && <Notice tone="bad">{action.error}</Notice>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" busy={action.busy} disabled={!pin}>
              Show key
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

export function ChangePinDialog({ wallet, onClose }: { wallet: WalletInfo; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [pin, setPin] = useState('');
  const [again, setAgain] = useState('');
  const action = useAction();
  return (
    <Dialog title={`Change PIN · ${wallet.label}`} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin !== again) return action.setError('The new PINs don’t match');
          void action.run(async () => {
            await changePin(wallet.id, current, pin);
            onClose();
          });
        }}
      >
        <PinInput label="Current PIN" value={current} onChange={setCurrent} autoFocus />
        <div className="grid gap-3 sm:grid-cols-2">
          <PinInput label="New PIN" value={pin} onChange={setPin} hint={`At least ${MIN_PIN_LENGTH} characters`} />
          <PinInput label="New PIN again" value={again} onChange={setAgain} />
        </div>
        {action.error && <Notice tone="bad">{action.error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={action.busy} disabled={!current || pin.length < MIN_PIN_LENGTH || pin !== again}>
            Change PIN
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RenameDialog({ wallet, onClose }: { wallet: WalletInfo; onClose: () => void }) {
  const [label, setLabel] = useState(wallet.label);
  const action = useAction();
  return (
    <Dialog title="Rename wallet" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await rename(wallet.id, label);
            onClose();
          });
        }}
      >
        <Field label="Name">
          <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} className={INPUT} />
        </Field>
        {action.error && <Notice tone="bad">{action.error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" busy={action.busy} disabled={!label.trim()}>
            Save
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DeleteWalletDialog({
  wallet,
  onClose,
  onShowKey,
}: {
  wallet: WalletInfo;
  onClose: () => void;
  onShowKey: () => void;
}) {
  const [typed, setTyped] = useState('');
  const action = useAction();
  return (
    <Dialog title={`Delete ${wallet.label}`} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            await removeWallet(wallet.id, typed);
            onClose();
          });
        }}
      >
        <Notice tone="bad">
          Deleting removes the wallet from this browser, and Builder Hub has no other copy. Without a saved private key,
          {` ${wallet.address}`} and anything it holds are gone for good.
        </Notice>
        <div>
          <Button type="button" variant="secondary" onClick={onShowKey}>
            Show private key first
          </Button>
        </div>
        <Field label="Type the start of the address to confirm" hint={`${wallet.address.slice(0, 8)}…`}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="0x…" className={INPUT} />
        </Field>
        {action.error && <Notice tone="bad">{action.error}</Notice>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" busy={action.busy} disabled={typed.trim().length < 6}>
            Delete wallet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
