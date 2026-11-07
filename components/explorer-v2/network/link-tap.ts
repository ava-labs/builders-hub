/* A page that writes its state into the URL late (history.replaceState) must stop once a link is tapped. The tap starts
   a navigation that ends only when the next page renders, and this page stays up until then. Next patches
   history.replaceState: a call with state that is not its own reaches the router as a restore of the URL it names, and
   the restore drops the navigation in flight, so the tap does nothing.

   The token is live until a plain tap on a same-tab link, or until end(). A tap with a modifier key, or on a link with
   a target, opens another tab and leaves this page's navigation alone. */
export function untilLinkTap(): { live: boolean; end: () => void } {
  const tap = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (e.target instanceof Element && e.target.closest("a[href]:not([target])")) stay.end();
  };
  const stay = {
    live: true,
    end: () => {
      stay.live = false;
      document.removeEventListener("click", tap, true);
    },
  };
  document.addEventListener("click", tap, true);
  return stay;
}
