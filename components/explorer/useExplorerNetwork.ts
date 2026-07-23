"use client";

import { useParams } from "next/navigation";

/** The explorer URL's network segment (/explorer/[network]/...), so links
 *  built by chain pages stay inside the network they're rendered under —
 *  a Fuji deployment's explorer must not leak back to its mainnet twin.
 *  Falls back to mainnet when rendered outside the segment. */
export function useExplorerNetwork(): string {
  const params = useParams();
  return typeof params?.network === "string" ? params.network : "mainnet";
}
