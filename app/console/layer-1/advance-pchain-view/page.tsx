import AdvancePChainView from '@/components/toolbox/console/layer-1/AdvancePChainView';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/advance-pchain-view");

export default function AdvancePChainViewPage() {
  return <AdvancePChainView />;
}
