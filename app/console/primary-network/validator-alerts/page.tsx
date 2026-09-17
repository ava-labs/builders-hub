import { AlertDashboard } from "@/components/validator-alerts/AlertDashboard";
import ToolboxConsoleWrapper from "@/components/toolbox/components/ToolboxConsoleWrapper";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/validator-alerts");

export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <AlertDashboard />
    </ToolboxConsoleWrapper>
  );
}
