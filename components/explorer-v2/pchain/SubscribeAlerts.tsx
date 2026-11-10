"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Check, Loader2, Plus } from "lucide-react";
import { useLoginModalTrigger } from "@/hooks/useLoginModal";
import { toast } from "@/lib/toast";

// Login reloads the page at its callbackUrl, so the intent to subscribe rides
// along as a query param and is picked up once the session is back.
const INTENT_PARAM = "subscribe";
const INTENT_VALUE = "alerts";

const CHIP =
  "inline-flex shrink-0 items-center gap-1.5 self-start border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors";

/** One click from the node page onto the /validator-alerts list, with the
 *  same defaults the add dialog starts from; tuning stays on that page. */
export function SubscribeAlerts({ nodeId }: { nodeId: string }) {
  const { data: session, status } = useSession();
  const { openLoginModal } = useLoginModalTrigger();
  const [state, setState] = useState<"idle" | "busy" | "subscribed">("idle");
  // covers a login that completes in place, without the reload
  const pending = useRef(false);

  const subscribe = useCallback(async () => {
    setState("busy");
    try {
      const res = await fetch("/api/validator-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId, subnet_id: "primary" }),
      });
      const result = await res.json().catch(() => ({}));
      if (res.ok || res.status === 409) {
        setState("subscribed");
        if (res.ok) {
          toast.success("Subscribed to alerts", `Uptime, version and expiry alerts go to ${session?.user?.email ?? "your email"}.`);
        }
        return;
      }
      setState("idle");
      toast.error("Could not subscribe", result.error ?? "Please try again.");
    } catch {
      setState("idle");
      toast.error("Could not subscribe", "Please try again.");
    }
  }, [nodeId, session?.user?.email]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const url = new URL(window.location.href);
    const intent = url.searchParams.get(INTENT_PARAM) === INTENT_VALUE;
    if (intent || pending.current) {
      pending.current = false;
      if (intent) {
        url.searchParams.delete(INTENT_PARAM);
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      subscribe();
      return;
    }
    // already on the list? show it instead of offering a duplicate
    let cancelled = false;
    fetch("/api/validator-alerts")
      .then((r) => (r.ok ? r.json() : []))
      .then((alerts: { node_id: string }[]) => {
        if (!cancelled && alerts.some((a) => a.node_id === nodeId)) setState("subscribed");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [status, nodeId, subscribe]);

  if (state === "subscribed") {
    return (
      <Link
        href="/validator-alerts"
        className={`${CHIP} border-emerald-600/30 text-emerald-600 hover:border-emerald-600 dark:border-emerald-400/30 dark:text-emerald-400 dark:hover:border-emerald-400`}
      >
        <Check className="h-3 w-3" strokeWidth={2.5} />
        Subscribed
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={state === "busy" || status === "loading"}
      onClick={() => {
        if (status === "authenticated") {
          subscribe();
          return;
        }
        pending.current = true;
        const url = new URL(window.location.href);
        url.searchParams.set(INTENT_PARAM, INTENT_VALUE);
        openLoginModal(`${url.pathname}${url.search}`);
      }}
      className={`${CHIP} border-zinc-200 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100`}
    >
      {state === "busy" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" strokeWidth={2.5} />}
      Subscribe to Alerts
    </button>
  );
}
