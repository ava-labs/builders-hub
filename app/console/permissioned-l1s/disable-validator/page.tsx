"use client";

import DisableValidator from "@/components/toolbox/console/permissioned-l1s/DisableValidator/DisableValidator";
import { DisableL1ValidatorProvider } from "@/components/toolbox/console/permissioned-l1s/DisableValidator/DisableL1ValidatorContext";

export default function DisableValidatorPage() {
  return (
    <DisableL1ValidatorProvider>
      <DisableValidator />
    </DisableL1ValidatorProvider>
  );
}
