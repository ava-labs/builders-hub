import { consoleToolMetadata } from "@/components/console/tool-metadata";
import MyL1DashboardPage from "./page.client";

// The interactive page is a client component (page.client.tsx), which cannot
// export metadata; this server wrapper carries the tool's social card.
export const metadata = consoleToolMetadata("/console/my-l1", "My L1 Dashboard");

export default function Page() {
  return <MyL1DashboardPage />;
}
