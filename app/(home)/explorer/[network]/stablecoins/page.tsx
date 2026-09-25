import { permanentRedirect } from "next/navigation";

/* Stablecoins moved to the C-Chain's DeFi tab. */
export default function NetworkStablecoinsPage() {
  permanentRedirect("/explorer/mainnet/c-chain/defi/stablecoins");
}
