import MonitoringSetup from '@/components/toolbox/console/layer-1/monitoring/MonitoringSetup';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/layer-1/monitoring-setup", "Monitoring Setup");

export default function Page() {
  return <MonitoringSetup />;
}
