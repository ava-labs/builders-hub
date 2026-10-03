import { buildTabs } from "@/components/explorer-v2/subnav-tabs";

/* Where the Mainnet/Fuji switch lands. Crossing networks keeps the page
   when the other network has its tab (blocks, gas/base-fee,
   validators/l1s). An entity page (a block, tx, address or node) lands on
   its tab's list, because its id means nothing on the other network. A
   section the other network has no tab for lands on the chain home. */
export function networkSwitchTarget(network: string, slug: string, pathname: string): string {
  const base = `/explorer/${network}/${slug}`;
  // the path below /explorer/<network>/<chain>; the chain's slug can differ per network (beam, beam-l1)
  const rest = pathname.split("/").filter(Boolean).slice(3);
  if (rest.length === 0) return base;
  const tabs = buildTabs(network, slug);
  const path = `${base}/${rest.join("/")}`;
  const tab = tabs.find((t) => t.isActive(path));
  if (tab) {
    // a block page lights the Blocks tab, but only a list path is the same page on both networks
    if (tab.href !== `${base}/${rest[0]}`) return tab.href;
    // a board belongs to one network (a shared board's link redirects back to it), so land on the boards list
    return path.startsWith(`${base}/query/boards/`) ? `${base}/query/boards` : path;
  }
  // Fuji has no Staking or L1s tab: those Fuji routes redirect to the validators list, so go there
  if (rest[0] === "staking" || rest[0] === "l1s") return tabs.find((t) => t.href === `${base}/validators`)?.href ?? base;
  return base;
}
