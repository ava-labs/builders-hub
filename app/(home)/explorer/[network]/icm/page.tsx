import { permanentRedirect } from "next/navigation";

/* ICM folded into the chains tab: the network map and each chain's 30-day
   messages live there now. Message pages stay at /icm/[messageId]. */
export default function NetworkIcmPage() {
  permanentRedirect("/explorer/mainnet/chains");
}
