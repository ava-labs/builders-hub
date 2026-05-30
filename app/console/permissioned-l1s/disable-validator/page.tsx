"use client";

import DisableValidator from "@/components/toolbox/console/permissioned-l1s/disable-validator/DisableValidator";
import { DisableL1ValidatorProvider } from "@/components/toolbox/console/permissioned-l1s/disable-validator/DisableL1ValidatorContext";

export default function DisableValidatorPage() {
  return (
    <DisableL1ValidatorProvider>
      <DisableValidator />
    </DisableL1ValidatorProvider>
  );
}
