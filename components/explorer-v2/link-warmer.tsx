"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";
import { warmReads } from "./warm-reads";

/* A link the pointer rests on is likely the next page, so its route and
   its first reads are fetched then: the click lands on a page that is
   already there. The explorer's routes are dynamic, and <Link> does not
   prefetch a dynamic route on its own. One listener covers every explorer
   link. A pointer that passes over a list warms nothing: only one that
   rests REST_MS on a link. Focus and touch warm at once, since the click
   comes next. */

const REST_MS = 70;
/* a link warmed this recently is not warmed again */
const AGAIN_MS = 15_000;
/* the whole route: the default ("auto") prefetch asks for a PPR shell, and
   these routes have none, so it fetched nothing a click could use */
const FULL = "full" as PrefetchKind;

function explorerHref(target: EventTarget | null): string | null {
  const a = target instanceof Element ? target.closest("a[href]") : null;
  const href = a?.getAttribute("href");
  return href?.startsWith("/explorer/") ? href : null;
}

export function LinkWarmer() {
  const router = useRouter();
  useEffect(() => {
    const warmed = new Map<string, number>();
    let rest: ReturnType<typeof setTimeout> | undefined;
    const warm = (href: string) => {
      const now = Date.now();
      // the page's own link: its reads are on screen already
      if (href.split(/[?#]/)[0] === location.pathname) return;
      if (now - (warmed.get(href) ?? 0) < AGAIN_MS) return;
      warmed.set(href, now);
      router.prefetch(href, { kind: FULL });
      warmReads(href);
    };
    const onOver = (e: PointerEvent) => {
      clearTimeout(rest);
      const href = explorerHref(e.target);
      if (href) rest = setTimeout(() => warm(href), e.pointerType === "mouse" ? REST_MS : 0);
    };
    const now = (e: Event) => {
      const href = explorerHref(e.target);
      if (href) warm(href);
    };
    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("focusin", now);
    document.addEventListener("touchstart", now, { passive: true });
    return () => {
      clearTimeout(rest);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("focusin", now);
      document.removeEventListener("touchstart", now);
    };
  }, [router]);
  return null;
}
