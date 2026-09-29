"use client";

import { useEffect, useState } from "react";

/* Primary ENS names for every address the explorer draws. Each component
   asks for one address; the asks of one render are gathered for a moment
   and sent as one request, and every answer (a name or none) is kept for
   the session, so a table of fifty rows costs one lookup and a re-render
   costs none. Names come back verified: the server checks that each one
   resolves to the address it names. */

const FLUSH_MS = 300;
const MAX_PER_REQUEST = 100;
const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

const known = new Map<string, string | null>();
const listeners = new Map<string, Set<() => void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function settle(addr: string, name: string | null) {
  known.set(addr, name);
  listeners.get(addr)?.forEach((fn) => fn());
}

async function flush() {
  timer = null;
  const batch = [...queue];
  queue = new Set();
  for (let i = 0; i < batch.length; i += MAX_PER_REQUEST) {
    const chunk = batch.slice(i, i + MAX_PER_REQUEST);
    try {
      const res = await fetch(`/api/explorer/ens?addresses=${chunk.join(",")}`);
      const body: { names?: Record<string, string | null> } = res.ok ? await res.json() : {};
      for (const a of chunk) settle(a, body.names?.[a] ?? null);
    } catch {
      for (const a of chunk) settle(a, null);
    }
  }
}

function request(addr: string) {
  if (known.has(addr) || queue.has(addr)) return;
  queue.add(addr);
  timer ??= setTimeout(flush, FLUSH_MS);
}

/** The address's primary ENS name, or null (unknown yet, none set, or not an
 *  EVM address). Pass enabled=false where a better label already exists, so
 *  no lookup is spent on it. */
export function useEnsName(addr: string | null | undefined, enabled = true): string | null {
  const a = addr && EVM_ADDRESS.test(addr) ? addr.toLowerCase() : null;
  const on = enabled && a !== null;
  const [, rerender] = useState(0);

  useEffect(() => {
    if (!on) return;
    const fn = () => rerender((n) => n + 1);
    let set = listeners.get(a);
    if (!set) listeners.set(a, (set = new Set()));
    set.add(fn);
    request(a);
    return () => {
      set.delete(fn);
    };
  }, [a, on]);

  return on ? known.get(a) ?? null : null;
}
