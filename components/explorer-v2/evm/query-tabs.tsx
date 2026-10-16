"use client";

/* Tabs on a Query page, with the page's history beside them. Each tab
   holds one thread and its answer. One page is mounted at a time, for the
   tab in view, and it opens on what that tab keeps, so a switch or a
   reload asks no model. The tab in view writes its thread to the URL
   (?q, &then), so a link still opens the answer it shows. Each thread
   that gets an answer goes into history (threads.ts). */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { EvmShell } from "@/components/explorer-v2/EvmShell";
import { NetworkShell } from "@/components/explorer-v2/network/NetworkShell";
import { ExplorerShell } from "@/components/explorer-v2/ExplorerShell";
import type { QueryAnswer, Turn } from "@/lib/explorer-query/types";
import {
  type HistoryEntry,
  type Kept,
  type TabSet,
  blankTab,
  closeTab,
  deleteEntry,
  keepEntry,
  landOn,
  newId,
  openTab,
  readTabs,
  reported,
  sameThread,
  threadOf,
  useHistory,
  useTabs,
  writeTabs,
} from "@/lib/explorer-query/threads";
import { PCHAIN_COLUMN } from "./QueryWorking";
import { type TabActions, TabsView } from "./query-tab-strip";

/** what a Query page and its tab tell each other */
export interface TabLink {
  /** what the page opens on: a kept answer, null for a blank tab, or undefined to ask the URL's thread */
  initial?: Kept | null;
  /* a thread from the URL that the page did not write (a link, a reload).
     "ask": the page asks it. A kept answer: the page opens on it. null:
     the thread is another tab's, which comes into view in a page of its
     own, so this page does nothing */
  land: (thread: string[]) => Kept | "ask" | null;
  /** the thread on the page's line, and its answer once one stands */
  onChange: (thread: string[], turns: Turn[], answer: QueryAnswer | null) => void;
}

/** the page the tab in view mounts: its key, the chain it opens on, and its link */
export interface TabMount {
  key: string;
  chain: string;
  link: TabLink;
}

/* each chain family's own chrome; stable components, so a re-render of
   the wrapper never remounts the page and loses its answer */
function QueryShell({ kind, scope, network, heading, children }: { kind: "evm" | "pchain"; scope?: "network"; network: string; heading: boolean; children: React.ReactNode }) {
  // no rise: the page paints its first frame with the HTML, and a box's shell has drawn that frame already
  if (scope === "network")
    return (
      <NetworkShell network={network} search={false} heading={heading} rise={false}>
        {children}
      </NetworkShell>
    );
  if (kind === "pchain")
    return (
      <ExplorerShell chain="p-chain" network={network} hideHeader heading={heading} rise={false}>
        <div className={PCHAIN_COLUMN}>{children}</div>
      </ExplorerShell>
    );
  return (
    <EvmShell network={network} search={false} heading={heading} rise={false}>
      {children}
    </EvmShell>
  );
}

/** the URL's thread: ?q, then each &then */
function urlThread(p: URLSearchParams): string[] {
  const q = p.get("q");
  return q ? [q, ...p.getAll("then")] : [];
}

export function QueryTabs({
  network,
  kind,
  scope,
  path,
  chain,
  onChain,
  off = false,
  children,
}: {
  network: string;
  kind: "evm" | "pchain";
  /** "network": the All Networks chrome */
  scope?: "network";
  /** the page's path: its tabs and its history are its own */
  path: string;
  /** the chain the page asks now */
  chain: string;
  /** the network's page: a tab on another chain moves the picker to it */
  onChain?: (chain: string) => void;
  /** a chain with nothing indexed: no tabs and no history */
  off?: boolean;
  children: (tab: TabMount) => React.ReactNode;
}) {
  const params = useSearchParams();
  const stored = useTabs(path);
  const entries = useHistory(path);
  // the first page asks the URL's thread; each tab put in view after it mounts a page of its own
  const [mount, setMount] = useState<{ key: string; chain: string; initial?: Kept | null }>({ key: "boot", chain });
  const landed = useRef(false);

  /** the tabs, once the page has landed on the URL's tab. The page reports before this wrapper's effect runs */
  const tabs = (): TabSet => {
    if (!landed.current) {
      landed.current = true;
      writeTabs(path, landOn(readTabs(path), urlThread(new URL(window.location.href).searchParams), chain));
    }
    return readTabs(path)!;
  };
  useEffect(() => void tabs(), []);

  /** a tab put in view: its thread in the URL (a link's is there already), and a page for it that opens on what it keeps */
  const show = (set: TabSet, linked = false) => {
    writeTabs(path, set);
    const tab = set.tabs.find((t) => t.id === set.active)!;
    if (!linked) {
      const url = new URL(window.location.href);
      for (const k of ["q", "then", "from"]) url.searchParams.delete(k);
      const thread = tab.kept ? threadOf(tab.kept) : tab.name ? [tab.name] : [];
      thread.forEach((q, i) => url.searchParams.append(i ? "then" : "q", q));
      if (onChain) url.searchParams.set("chain", tab.chain);
      window.history.replaceState(null, "", url.toString());
    }
    if (onChain && tab.chain !== chain) onChain(tab.chain);
    // a tab that left while it asked has no answer to open on: it asks again
    setMount({ key: tab.id, chain: tab.chain, initial: tab.kept ?? (tab.name ? undefined : null) });
  };

  const actions: TabActions = {
    onSelect: (id) => {
      const s = tabs();
      if (id !== s.active) show({ ...s, active: id });
    },
    onClose: (id) => {
      const s = tabs();
      const next = closeTab(s, id, chain);
      if (next.active !== s.active) show(next);
      else writeTabs(path, next);
    },
    // a blank tab is reused, so the strip holds one at most
    onNew: () => {
      const s = tabs();
      const blank = s.tabs.find((t) => !t.name && !t.kept);
      show(blank ? { ...s, active: blank.id } : openTab(s, blankTab(chain)));
    },
    onOpen: (e: HistoryEntry) => {
      const s = tabs();
      const held = s.tabs.find((t) => t.entry === e.id);
      show(held ? { ...s, active: held.id } : openTab(s, { id: newId(), entry: e.id, chain: e.chain, name: threadOf(e.kept)[0] ?? null, kept: e.kept }));
    },
    onDelete: (id) => deleteEntry(path, id),
  };

  const link: TabLink = {
    initial: mount.initial,
    land: (thread) => {
      const s = tabs();
      const next = landOn(s, thread, chain);
      // the page in view holds its own tab's answer: another tab gets a page of its own
      if (next.active !== s.active) {
        show(next, true);
        return null;
      }
      writeTabs(path, next);
      const tab = next.tabs.find((t) => t.id === next.active)!;
      return tab.kept && sameThread(threadOf(tab.kept), thread) ? tab.kept : "ask";
    },
    onChange: (thread, turns, answer) => {
      const s = tabs();
      const tab = s.tabs.find((t) => t.id === s.active);
      if (!tab) return;
      const next = reported(tab, thread, turns, answer, chain);
      if (next === tab) return;
      writeTabs(path, { ...s, tabs: s.tabs.map((t) => (t.id === tab.id ? next : t)) });
      if (next.kept && next.kept !== tab.kept) keepEntry(path, { id: next.entry, chain, at: Date.now(), kept: next.kept });
      // a tab moved to another chain (the network's picker) no longer opens on its old answer
      if (chain !== mount.chain) setMount((m) => ({ ...m, chain, initial: undefined }));
    },
  };

  // until the page lands, the strip draws its landing on the URL's thread, so it never jumps
  const view = landed.current && stored ? stored : landOn(stored, urlThread(params), chain, "boot");
  const answered = !!view.tabs.find((t) => t.id === view.active)?.kept;

  return (
    // the page's answer title is its h1 once one stands
    <QueryShell kind={kind} scope={scope} network={network} heading={!answered}>
      <TabsView tabs={view.tabs} active={view.active} entries={entries} actions={actions} off={off}>
        {children({ key: mount.key, chain: mount.chain, link })}
      </TabsView>
    </QueryShell>
  );
}
