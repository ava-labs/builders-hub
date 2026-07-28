import { redirect } from "next/navigation";

// The AVAX Burners treemap grew into the C-Chain gas market page, which
// carries the same protocol attribution (contract registry) on top of the
// live fee market — one page owns the story now. Inbound links keep
// working via this redirect.
export default function TreemapPage() {
  redirect("/explorer/mainnet/c-chain/gas");
}
