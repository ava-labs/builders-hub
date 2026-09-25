import { permanentRedirect } from "next/navigation";

/* /explorer opens the network view directly: the explorer has no splash. */
export default function ExplorerHome() {
  permanentRedirect("/explorer/mainnet");
}
