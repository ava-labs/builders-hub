/**
 * Buffer polyfill injected into the wallet-shim IIFE bundle (see
 * e2e/fixtures.ts `inject`). The shim signs XP-chain transactions in-page via
 * @avalanche-sdk/client, which expects a global Buffer — in a real browser the
 * Core extension does this in its own context, so the page never needs one.
 * esbuild's `inject` evaluates this before the rest of the bundle, so Buffer
 * exists by the time any shim code runs.
 */
import { Buffer } from 'buffer/';

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) {
  g.Buffer = Buffer;
}

export {};
