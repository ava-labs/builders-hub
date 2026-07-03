'use client';

import { MessengerInspector } from './MessengerInspector';
import { RegistryInspector } from './RegistryInspector';
import { RelayerInspector } from './RelayerInspector';
import { DemoInspector } from './DemoInspector';
import { LiveInspector } from './LiveInspector';

/**
 * Thin step wrappers exposed to `icm-steps.ts`. Each inspector deploys
 * against the wallet's current chain — there's no per-phase chain gate,
 * because ICM operations are per-L1 and the wallet is the source of truth
 * for which L1 the user is configuring. The user changes L1 via the
 * global wallet picker in the page header.
 */

export function MessengerStep() {
  return <MessengerInspector />;
}

export function RegistryStep() {
  return <RegistryInspector />;
}

export function RelayerStep() {
  return <RelayerInspector />;
}

export function DemoStep() {
  return <DemoInspector />;
}

export function LiveStep() {
  return <LiveInspector />;
}
