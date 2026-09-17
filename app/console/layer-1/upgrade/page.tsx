import { consoleToolMetadata } from "@/components/console/tool-metadata";
import UpgradeL1Page from "./page.client";

// The interactive page is a client component (page.client.tsx), which cannot
// export metadata; this server wrapper carries the tool's social card.
export const metadata = consoleToolMetadata("/console/layer-1/upgrade");

export default function Page() {
  return <UpgradeL1Page />;
}
