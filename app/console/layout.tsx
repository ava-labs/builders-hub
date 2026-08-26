import type { ReactNode } from "react";
import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import ConsoleLayoutClient from "./layout.client";

const ogImage = { url: "/api/og/console", width: 1200, height: 630, alt: "Avalanche Builder Console" };

// The interactive layout is a client component (layout.client.tsx), which
// cannot export metadata; this server wrapper carries it for /console/**.
export const metadata: Metadata = createMetadata({
  title: "Console",
  description:
    "Launch and operate Avalanche L1s: create chains, manage validators, and run interchain tooling.",
  openGraph: { url: "/console", images: ogImage },
  twitter: { images: ogImage },
});

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleLayoutClient>{children}</ConsoleLayoutClient>;
}
