import TokenManagement from "@/components/toolbox/console/utilities/data-api-keys/TokenManagement";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/utilities/data-api-keys");

export default function Page() {
  return <TokenManagement />;
}
