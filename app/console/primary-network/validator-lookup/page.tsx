import ValidatorLookup from "@/components/toolbox/console/primary-network/ValidatorLookup";
import ToolboxConsoleWrapper from "@/components/toolbox/components/ToolboxConsoleWrapper";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/primary-network/validator-lookup", "Validator Lookup");

export default function Page() {
  return (
    <ToolboxConsoleWrapper>
      <ValidatorLookup />
    </ToolboxConsoleWrapper>
  );
}
