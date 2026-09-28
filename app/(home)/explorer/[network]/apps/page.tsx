import { permanentRedirect } from "next/navigation";

/* Protocols moved to the C-Chain's DeFi tab. */
export default function NetworkAppsPage() {
  permanentRedirect("/explorer/mainnet/c-chain/defi");
}
