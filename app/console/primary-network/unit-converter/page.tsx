import UnitConverter from "@/components/toolbox/console/primary-network/UnitConverter";
import ToolboxConsoleWrapper from "@/components/toolbox/components/ToolboxConsoleWrapper";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/unit-converter");

export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <UnitConverter />
    </ToolboxConsoleWrapper>
  );
}
