import { redirect } from "next/navigation";

/* /explorer opens the city: every chain on one map, with the explorer's
   search in its panel. A temporary redirect, so the front door can move
   without browsers holding on to an old target. */
export default function ExplorerHome() {
  redirect("/explorer/mainnet/chains");
}
