import { consoleToolMetadata } from "@/components/console/tool-metadata";
import BasicCreateL1Page from "./page.client";

// The interactive page is a client component (page.client.tsx), which cannot
// export metadata; this server wrapper carries the tool's social card. The
// client file keeps its own 'use client', so its hook-bearing imports
// (CheckRequirements, wallet requirement hooks) stay out of the server graph.
export const metadata = consoleToolMetadata("/console/create-l1", "Create L1");

export default function Page() {
  return <BasicCreateL1Page />;
}
