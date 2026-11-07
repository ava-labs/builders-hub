import { useEffect, type RefObject } from "react";
import type { CameraHandle } from "@/components/explorer-v2/network/icm-map";
import { PCHAIN_PICK } from "@/components/explorer-v2/network/city-model";
import type { District } from "@/components/explorer-v2/network/districts";
import { untilLinkTap } from "@/components/explorer-v2/network/link-tap";

/* The City writes its open chain, district and route into the URL, so a link opens them. It starts once the City has
   restored them from the URL (restored), and it writes after the camera lands. */
export function useCityUrl({
  restored,
  selected,
  focus,
  route,
  rowById,
  camera,
}: {
  restored: RefObject<boolean>;
  selected: string | null;
  focus: District | null;
  route: string | null;
  rowById: ReadonlyMap<string, { id: string; chain: { slug: string } | null }>;
  camera: RefObject<CameraHandle | null>;
}) {
  useEffect(() => {
    if (!restored.current) return;
    /* it follows once the camera lands, in an idle slot: the router's render of the page, which the URL's change sets off,
       holds no frame of the flight. It stops at a link tap (link-tap.ts), and once the page's path has changed: a write
       then would put this page's chain on the next page's URL, or undo the navigation */
    const stay = untilLinkTap();
    const path = window.location.pathname;
    let idle = 0;
    let asked = false;
    const sync = () => {
      if (!stay.live || window.location.pathname !== path) return;
      const p = new URLSearchParams(window.location.search);
      const r = selected ? rowById.get(selected) : null;
      if (r) p.set("chain", r.chain?.slug ?? r.id);
      else if (selected === PCHAIN_PICK) p.set("chain", PCHAIN_PICK);
      else p.delete("chain");
      if (focus) p.set("district", focus);
      else p.delete("district");
      if (route) p.set("route", route);
      else p.delete("route");
      // the one view needs no name in the URL; an old link's view=model or view=3d is let go
      p.delete("view");
      const s = p.toString();
      const next = `${window.location.pathname}${s ? `?${s}` : ""}${window.location.hash}`;
      // null, not history.state: state that carries Next's own mark is not synced into the router, which then writes its stale URL back
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(null, "", next);
    };
    const later = () => {
      if (!stay.live || asked) return;
      asked = true;
      idle = window.requestIdleCallback ? window.requestIdleCallback(sync, { timeout: 1500 }) : window.setTimeout(sync, 200);
    };
    const clock = setTimeout(later, 2200);
    void (camera.current?.settled() ?? Promise.resolve()).then(later);
    return () => {
      stay.end();
      clearTimeout(clock);
      if (idle) (window.cancelIdleCallback ?? window.clearTimeout)(idle);
    };
  }, [restored, camera, selected, focus, rowById, route]);
}
