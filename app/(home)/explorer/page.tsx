import { redirect } from "next/navigation";

/* The Platform Chain explorer is the default: /explorer opens it on mainnet.
   The all-chains EVM directory lives at /explorer/chains. */
export default function ExplorerHome() {
  redirect("/explorer/mainnet/p-chain");
}
