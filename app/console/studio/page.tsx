import type { Metadata } from "next";
import { StudioHome } from "@/components/studio/StudioHome";

export const metadata: Metadata = {
  title: "Studio",
  description: "Describe an app and ship it on Avalanche: contracts, tests, audits and testnet deployments, then a gated migration to production.",
};

export default function StudioPage() {
  return <StudioHome />;
}
