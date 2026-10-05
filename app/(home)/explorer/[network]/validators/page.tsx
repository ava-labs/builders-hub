import { permanentRedirect } from "next/navigation";

/* The network's validator sets folded into the chains tab: the map paints
   each set by client version and the directory carries the share on
   target. Primary Network staking stays at /p-chain/validators. */
export default function NetworkValidatorsPage() {
  permanentRedirect("/explorer/mainnet/chains");
}
