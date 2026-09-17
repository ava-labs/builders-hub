import DisableValidator from "@/components/toolbox/console/permissioned-l1s/disable-validator/DisableValidator";
import { DisableL1ValidatorProvider } from "@/components/toolbox/console/permissioned-l1s/disable-validator/DisableL1ValidatorContext";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/disable-validator", "Disable Validator");

export default function DisableValidatorPage() {
  return (
    <DisableL1ValidatorProvider>
      <DisableValidator />
    </DisableL1ValidatorProvider>
  );
}
