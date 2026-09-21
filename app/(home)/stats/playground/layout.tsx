import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createMetadata } from "@/utils/metadata";

export const metadata: Metadata = createMetadata({
  title: "Playground",
  description:
    "Create and customize charts with real-time Avalanche chain metrics. Add metrics, configure visualizations, and share your insights.",
  openGraph: { url: "/stats/playground" },
});

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return children;
}
