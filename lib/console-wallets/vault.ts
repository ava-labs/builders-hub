import { getAddress, isHex, type Hex } from 'viem';
import { generatePrivateKey, privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { privateKeyToAvalancheAccount } from '@avalanche-sdk/client/accounts';
import { PBKDF2_ITERATIONS, checkPin, openKey, sealKey, type SealedKey } from './crypto';

/**
 * Console wallets: private keys kept only in this browser, sealed with the
 * builder's PIN. Builder Hub never receives them, so nothing can be recovered
 * from the server; a wallet survives only as long as this browser's site data
 * or the key the builder saved.
 */

export interface WalletRecord extends SealedKey {
  id: string;
  label: string;
  address: `0x${string}`;
  /** Public, so a locked wallet can still show its P-Chain address; older records gain them on the next unlock. */
  publicKeys?: { evm: Hex; xp: Hex };
  backedUp: boolean;
  createdAt: string;
}

/** What the UI may see: never the sealed key. */
export type WalletInfo = Pick<WalletRecord, 'id' | 'label' | 'address' | 'publicKeys' | 'backedUp' | 'createdAt'> & {
  unlocked: boolean;
};

export interface WalletStorage {
  all(): Promise<WalletRecord[]>;
  get(id: string): Promise<WalletRecord | undefined>;
  put(record: WalletRecord): Promise<void>;
  delete(id: string): Promise<void>;
}

export const IDLE_LOCK_MS = 15 * 60 * 1000;
const DB_NAME = 'console-wallets';
const STORE = 'wallets';
const CHANNEL = 'console-wallets';

function indexedDbStorage(): WalletStorage {
  let db: Promise<import('idb').IDBPDatabase> | null = null;
  const open = () =>
    (db ??= import('idb').then(({ openDB }) =>
      openDB(DB_NAME, 1, {
        upgrade(d) {
          d.createObjectStore(STORE, { keyPath: 'id' });
        },
      }),
    ));
  return {
    all: async () => (await (await open()).getAll(STORE)) as WalletRecord[],
    get: async (id) => (await (await open()).get(STORE, id)) as WalletRecord | undefined,
    put: async (record) => {
      await (await open()).put(STORE, record);
    },
    delete: async (id) => {
      await (await open()).delete(STORE, id);
    },
  };
}

export function memoryStorage(): WalletStorage {
  const rows = new Map<string, WalletRecord>();
  return {
    all: async () => [...rows.values()].map((r) => ({ ...r })),
    get: async (id) => (rows.has(id) ? { ...rows.get(id)! } : undefined),
    put: async (record) => void rows.set(record.id, { ...record }),
    delete: async (id) => void rows.delete(id),
  };
}

let storage: WalletStorage | null = null;
let iterations = PBKDF2_ITERATIONS;
const store = () => (storage ??= indexedDbStorage());

/** Tests swap in memory storage and a cheaper work factor. */
export function configureVault(options: { storage?: WalletStorage; iterations?: number }) {
  if (options.storage) storage = options.storage;
  if (options.iterations) iterations = options.iterations;
  lockAll({ broadcast: false });
}

/* Unlocked wallets: an account object in this tab's memory only, dropped after idle time. */

/** The same key as an EVM account and as Avalanche P/X-Chain signer, for the console's Core-compatible provider. */
export type AvalancheAccount = ReturnType<typeof privateKeyToAvalancheAccount>;

const publicKeysOf = (a: AvalancheAccount) => ({
  evm: a.evmAccount.publicKey as Hex,
  xp: a.xpAccount!.publicKey as Hex,
});

const unlocked = new Map<
  string,
  { account: PrivateKeyAccount; avalanche: AvalancheAccount; timer: ReturnType<typeof setTimeout> }
>();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | null | undefined;

type Message = { type: 'changed' } | { type: 'lock-all' } | { type: 'removed'; id: string };

function bus() {
  if (channel !== undefined) return channel;
  channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  // Node keeps a process alive for an open channel; browsers have no unref.
  (channel as { unref?: () => void } | null)?.unref?.();
  channel?.addEventListener('message', (e: MessageEvent<Message>) => {
    if (e.data?.type === 'lock-all') lockAll({ broadcast: false });
    else if (e.data?.type === 'removed') lock(e.data.id);
    else notify();
  });
  return channel;
}

function notify() {
  for (const fn of listeners) fn();
}

function changed(message: Message = { type: 'changed' }) {
  notify();
  bus()?.postMessage(message);
}

export function subscribe(fn: () => void) {
  bus();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function armTimer(id: string) {
  return setTimeout(() => lock(id), IDLE_LOCK_MS);
}

export function isUnlocked(id: string) {
  return unlocked.has(id);
}

export function lock(id: string) {
  const entry = unlocked.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  unlocked.delete(id);
  notify();
}

export function lockAll({ broadcast = true } = {}) {
  for (const entry of unlocked.values()) clearTimeout(entry.timer);
  const had = unlocked.size > 0;
  unlocked.clear();
  if (had) notify();
  if (broadcast) bus()?.postMessage({ type: 'lock-all' } satisfies Message);
}

/** The unlocked account for signing; each use pushes the idle lock back. */
export function accountFor(id: string): PrivateKeyAccount | null {
  const entry = unlocked.get(id);
  if (!entry) return null;
  clearTimeout(entry.timer);
  entry.timer = armTimer(id);
  return entry.account;
}

/** The unlocked wallet as an Avalanche account (EVM and P/X-Chain); each use pushes the idle lock back too. */
export function avalancheAccountFor(id: string): AvalancheAccount | null {
  return accountFor(id) ? unlocked.get(id)!.avalanche : null;
}

const info = (r: WalletRecord): WalletInfo => ({
  id: r.id,
  label: r.label,
  address: r.address,
  publicKeys: r.publicKeys,
  backedUp: r.backedUp,
  createdAt: r.createdAt,
  unlocked: unlocked.has(r.id),
});

export async function listWallets(): Promise<WalletInfo[]> {
  const rows = await store().all();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(info);
}

async function required(id: string) {
  const record = await store().get(id);
  if (!record) throw new Error('That wallet is no longer in this browser');
  return record;
}

const newId = () =>
  globalThis.crypto.randomUUID?.() ??
  Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

async function add(privateKey: Hex, label: string, pin: string, backedUp: boolean) {
  checkPin(pin);
  const account = privateKeyToAccount(privateKey);
  const existing = (await store().all()).find((r) => r.address.toLowerCase() === account.address.toLowerCase());
  if (existing) throw new Error(`This browser already has that wallet as “${existing.label}”`);
  const avalanche = privateKeyToAvalancheAccount(privateKey);
  const record: WalletRecord = {
    id: newId(),
    label: label.trim() || `Wallet ${account.address.slice(2, 6)}`,
    address: account.address as `0x${string}`,
    publicKeys: publicKeysOf(avalanche),
    backedUp,
    createdAt: new Date().toISOString(),
    ...(await sealKey(privateKey, pin, account.address, iterations)),
  };
  await store().put(record);
  unlocked.set(record.id, { account, avalanche, timer: armTimer(record.id) });
  changed();
  return info(record);
}

/** A fresh key; it stays unlocked so the builder can save it straight away. */
export function createWallet(label: string, pin: string) {
  return add(generatePrivateKey(), label, pin, false);
}

/** A key the builder already holds, so it counts as backed up. */
export async function importWallet(privateKey: string, label: string, pin: string) {
  const key = (privateKey.trim().startsWith('0x') ? privateKey.trim() : `0x${privateKey.trim()}`) as Hex;
  if (!isHex(key) || key.length !== 66) throw new Error('A private key is 64 hex characters, with or without 0x');
  return add(key, label, pin, true);
}

export async function unlock(id: string, pin: string) {
  const record = await required(id);
  const key = await openKey(record, pin, record.address);
  const account = privateKeyToAccount(key);
  if (getAddress(account.address) !== getAddress(record.address)) throw new Error('This wallet record is damaged');
  const avalanche = privateKeyToAvalancheAccount(key);
  lock(id);
  unlocked.set(id, { account, avalanche, timer: armTimer(id) });
  if (!record.publicKeys) {
    record.publicKeys = publicKeysOf(avalanche);
    await store().put(record);
    changed();
  } else notify();
  return info(record);
}

/** Always asks for the PIN, even when the wallet is unlocked. */
export async function reveal(id: string, pin: string): Promise<Hex> {
  const record = await required(id);
  return openKey(record, pin, record.address);
}

export async function markBackedUp(id: string) {
  const record = await required(id);
  if (record.backedUp) return;
  await store().put({ ...record, backedUp: true });
  changed();
}

export async function rename(id: string, label: string) {
  const record = await required(id);
  await store().put({ ...record, label: label.trim() || record.label });
  changed();
}

export async function changePin(id: string, oldPin: string, newPin: string) {
  const record = await required(id);
  const key = await openKey(record, oldPin, record.address);
  await store().put({ ...record, ...(await sealKey(key, newPin, record.address, iterations)) });
  changed();
}

/** Deleting needs the start of the address typed back, so a key isn't thrown away by a stray click. */
export async function removeWallet(id: string, typedAddress: string) {
  const record = await required(id);
  const typed = typedAddress.trim().toLowerCase();
  if (typed.length < 6 || !record.address.toLowerCase().startsWith(typed)) {
    throw new Error('Type the first characters of the address (from 0x) to delete this wallet');
  }
  await store().delete(id);
  lock(id);
  changed({ type: 'removed', id });
}
