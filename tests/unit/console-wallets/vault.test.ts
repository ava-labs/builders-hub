import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { openKey, sealKey, WrongPinError } from '@/lib/console-wallets/crypto';
import {
  IDLE_LOCK_MS,
  accountFor,
  changePin,
  configureVault,
  createWallet,
  importWallet,
  isUnlocked,
  listWallets,
  lockAll,
  markBackedUp,
  memoryStorage,
  removeWallet,
  reveal,
  unlock,
  type WalletStorage,
} from '@/lib/console-wallets/vault';

const KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;
const PIN = 'correct-horse';

let storage: WalletStorage;

beforeEach(() => {
  storage = memoryStorage();
  configureVault({ storage, iterations: 1_000 });
});

afterEach(() => {
  vi.useRealTimers();
  lockAll({ broadcast: false });
});

describe('sealKey / openKey', () => {
  const address = privateKeyToAccount(KEY).address;

  it('round-trips a key with the right PIN', async () => {
    const sealed = await sealKey(KEY, PIN, address, 1_000);
    expect(sealed.ciphertext).not.toContain(KEY.slice(2, 12));
    await expect(openKey(sealed, PIN, address)).resolves.toBe(KEY);
  });

  it('rejects a wrong PIN', async () => {
    const sealed = await sealKey(KEY, PIN, address, 1_000);
    await expect(openKey(sealed, 'wrong-pin', address)).rejects.toBeInstanceOf(WrongPinError);
  });

  it('rejects the sealed key under another address', async () => {
    const sealed = await sealKey(KEY, PIN, address, 1_000);
    await expect(openKey(sealed, PIN, '0x000000000000000000000000000000000000dEaD')).rejects.toBeInstanceOf(
      WrongPinError,
    );
  });

  it('rejects a tampered ciphertext', async () => {
    const sealed = await sealKey(KEY, PIN, address, 1_000);
    const bytes = Uint8Array.from(atob(sealed.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] ^= 1;
    const tampered = { ...sealed, ciphertext: btoa(String.fromCharCode(...bytes)) };
    await expect(openKey(tampered, PIN, address)).rejects.toBeInstanceOf(WrongPinError);
  });

  it('uses a fresh salt and IV every time', async () => {
    const a = await sealKey(KEY, PIN, address, 1_000);
    const b = await sealKey(KEY, PIN, address, 1_000);
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('refuses a short PIN', async () => {
    await expect(sealKey(KEY, '12345', address, 1_000)).rejects.toThrow(/at least 6/);
  });
});

describe('vault', () => {
  it('creates an unlocked, not-backed-up wallet and never lists the sealed key', async () => {
    const wallet = await createWallet('Deployer', PIN);
    expect(wallet).toMatchObject({ label: 'Deployer', backedUp: false, unlocked: true });
    const [listed] = await listWallets();
    expect(Object.keys(listed).sort()).toEqual([
      'address',
      'backedUp',
      'createdAt',
      'id',
      'label',
      'publicKeys',
      'unlocked',
    ]);
    expect(Object.keys(listed.publicKeys!).sort()).toEqual(['evm', 'xp']);
    expect(accountFor(wallet.id)?.address).toBe(wallet.address);
  });

  it('imports a key as backed up and refuses the same address twice', async () => {
    const wallet = await importWallet(KEY.slice(2), 'Mine', PIN);
    expect(wallet.address).toBe(privateKeyToAccount(KEY).address);
    expect(wallet.backedUp).toBe(true);
    await expect(importWallet(KEY, 'Again', PIN)).rejects.toThrow(/already has that wallet/);
    await expect(importWallet('0x1234', 'Bad', PIN)).rejects.toThrow(/64 hex/);
  });

  it('unlocks with the PIN and rejects a wrong one', async () => {
    const wallet = await importWallet(KEY, 'Mine', PIN);
    lockAll({ broadcast: false });
    expect(isUnlocked(wallet.id)).toBe(false);
    await expect(unlock(wallet.id, 'not-the-pin')).rejects.toThrow('Wrong PIN');
    await unlock(wallet.id, PIN);
    expect(isUnlocked(wallet.id)).toBe(true);
  });

  it('asks for the PIN to reveal the key even while unlocked', async () => {
    const wallet = await importWallet(KEY, 'Mine', PIN);
    expect(isUnlocked(wallet.id)).toBe(true);
    await expect(reveal(wallet.id, 'not-the-pin')).rejects.toThrow('Wrong PIN');
    await expect(reveal(wallet.id, PIN)).resolves.toBe(KEY);
  });

  it('locks after the idle time, and each use pushes it back', async () => {
    vi.useFakeTimers();
    const wallet = await importWallet(KEY, 'Mine', PIN);
    vi.advanceTimersByTime(IDLE_LOCK_MS - 1_000);
    expect(accountFor(wallet.id)).not.toBeNull();
    vi.advanceTimersByTime(IDLE_LOCK_MS - 1_000);
    expect(isUnlocked(wallet.id)).toBe(true);
    vi.advanceTimersByTime(2_000);
    expect(isUnlocked(wallet.id)).toBe(false);
    expect(accountFor(wallet.id)).toBeNull();
  });

  it('changes the PIN', async () => {
    const wallet = await importWallet(KEY, 'Mine', PIN);
    await expect(changePin(wallet.id, 'nope-nope', 'new-pin-123')).rejects.toThrow('Wrong PIN');
    await changePin(wallet.id, PIN, 'new-pin-123');
    await expect(reveal(wallet.id, PIN)).rejects.toThrow('Wrong PIN');
    await expect(reveal(wallet.id, 'new-pin-123')).resolves.toBe(KEY);
  });

  it('marks a wallet backed up', async () => {
    const wallet = await createWallet('Fresh', PIN);
    await markBackedUp(wallet.id);
    expect((await listWallets())[0].backedUp).toBe(true);
  });

  it('deletes only when the address prefix is typed back', async () => {
    const wallet = await importWallet(KEY, 'Mine', PIN);
    await expect(removeWallet(wallet.id, '0x')).rejects.toThrow(/first characters/);
    await expect(removeWallet(wallet.id, '0xdead00')).rejects.toThrow(/first characters/);
    await removeWallet(wallet.id, wallet.address.slice(0, 8));
    expect(await listWallets()).toEqual([]);
    expect(isUnlocked(wallet.id)).toBe(false);
  });
});
