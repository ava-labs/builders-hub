import { permanentRedirect } from "next/navigation";

/* Playground gave way to Query: ask in plain words, pin the charts to a
   board. The old dashboards land there. */
export default function PlaygroundPage() {
  permanentRedirect("/explorer/mainnet/query");
}
