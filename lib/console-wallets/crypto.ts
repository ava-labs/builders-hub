import type { Hex } from 'viem';

/** PBKDF2 work factor for new wallets; stored per record so it can be raised later without breaking old ones. */
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PIN_LENGTH = 6;

export interface SealedKey {
  salt: string;
  iv: string;
  ciphertext: string;
  kdf: { name: 'PBKDF2-SHA256'; iterations: number };
}

export class WrongPinError extends Error {
  constructor() {
    super('Wrong PIN');
    this.name = 'WrongPinError';
  }
}

const subtle = () => {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new Error('This browser has no WebCrypto; Console wallets need a secure (https) page');
  return s;
};

const toB64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));
const utf8 = (value: string) => new TextEncoder().encode(value);
/** The address is bound to the ciphertext, so a sealed key can't be moved onto another record. */
const aad = (address: string) => utf8(`console-wallet:${address.toLowerCase()}`);

export function checkPin(pin: string) {
  if (pin.length < MIN_PIN_LENGTH) throw new Error(`Use a PIN of at least ${MIN_PIN_LENGTH} characters`);
}

async function deriveKey(pin: string, salt: Uint8Array, iterations: number) {
  const base = await subtle().importKey('raw', utf8(pin), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function sealKey(
  privateKey: Hex,
  pin: string,
  address: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<SealedKey> {
  checkPin(pin);
  const salt = random(16);
  const iv = random(12);
  const key = await deriveKey(pin, salt, iterations);
  const ciphertext = new Uint8Array(
    await subtle().encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource, additionalData: aad(address) as BufferSource },
      key,
      utf8(privateKey) as BufferSource,
    ),
  );
  return {
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
    kdf: { name: 'PBKDF2-SHA256', iterations },
  };
}

export async function openKey(sealed: SealedKey, pin: string, address: string): Promise<Hex> {
  const key = await deriveKey(pin, fromB64(sealed.salt), sealed.kdf.iterations);
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromB64(sealed.iv) as BufferSource, additionalData: aad(address) as BufferSource },
      key,
      fromB64(sealed.ciphertext) as BufferSource,
    );
    return new TextDecoder().decode(plain) as Hex;
  } catch {
    throw new WrongPinError();
  }
}
