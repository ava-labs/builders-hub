import { redirect } from "next/navigation";

/* /explorer opens the network overview: a visitor to an explorer expects
   blocks and transactions first. The city is one tab away, on Chains. A
   temporary redirect, so the front door can move without browsers holding
   on to an old target. */
export default function ExplorerHome() {
  redirect("/explorer/mainnet");
}
