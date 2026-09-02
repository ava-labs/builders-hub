import { consoleToolMetadata } from "@/components/console/tool-metadata";
import CreateL1Page from "./page.client";

// The interactive page is a client component (page.client.tsx), which cannot
// export metadata; this server wrapper carries the tool's social card.
export const metadata = consoleToolMetadata("/console/create-l1", "Create L1");

export default function Page() {
  return <CreateL1Page />;
}
