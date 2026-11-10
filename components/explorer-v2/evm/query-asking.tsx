"use client";

import { createContext, startTransition, useCallback, useContext, useOptimistic, useRef } from "react";
import { RouterRef, type Router } from "@/components/explorer-v2/router-ref";

/* Enter on a question opens the Query page at once. A search box sits in a
   shell, and the shell holds the question as an optimistic value for as
   long as the navigation to the Query page runs: React keeps the value
   while the router's transition is pending, and drops it in the same
   commit that puts the Query page on screen. While it holds, the shell
   draws the Query page's first frame (QueryWorking) in place of its body,
   its subnav marks the Query tab, and the page then draws the same frame
   from ?q. Until that commit the URL and the history entry are still the
   page the question was asked on (Next writes them at the commit): Back in
   that wait, one server round trip, goes back from that page, as it did
   while the old page stayed on screen. */

/** open a question on its Query page */
export type AskTo = (href: string, question: string) => void;

const Asking = createContext<AskTo | null>(null);
/** the path of the Query page a question is on its way to; null when none is */
const AskedPath = createContext<string | null>(null);

/** the shell's side: what stands above its body (the subnav), and its body, or the Query page's first frame while a question is on its way there */
export function AskingFrame({ above, working, children }: { above?: React.ReactNode; working: (question: string) => React.ReactNode; children: React.ReactNode }) {
  // the router from a leaf, so the shell does not render again at each change of the URL
  const router = useRef<Router | null>(null);
  const [asking, setAsking] = useOptimistic<{ question: string; path: string } | null>(null);
  const askTo = useCallback<AskTo>(
    (href, question) =>
      startTransition(() => {
        setAsking({ question, path: href.split(/[?#]/)[0] });
        router.current?.push(href);
      }),
    [setAsking],
  );
  // a frame drawn inside another frame's first frame (the city's) keeps the path that one is on its way to
  const outer = useContext(AskedPath);
  return (
    <Asking.Provider value={askTo}>
      <AskedPath.Provider value={asking?.path ?? outer}>
        <RouterRef into={router} />
        {above}
        {asking === null ? children : working(asking.question)}
      </AskedPath.Provider>
    </Asking.Provider>
  );
}

/** the box's side: the shell's ask, or null outside a shell (the box then navigates on its own) */
export function useAskTo(): AskTo | null {
  return useContext(Asking);
}

/** the path the page is on its way to while a question is, for the subnav's tabs; null when none is */
export function useAskedPath(): string | null {
  return useContext(AskedPath);
}
