import { permanentRedirect } from "next/navigation";

/* The network stats live on the All Networks overview now. */
export default function AllChainsStatsPage() {
  permanentRedirect("/explorer/mainnet");
}
