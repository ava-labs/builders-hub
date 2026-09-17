import ExplorerSetup from '@/components/toolbox/console/layer-1/explorer/ExplorerSetup';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/explorer-setup");

export default function Page() {
  return <ExplorerSetup />;
}
