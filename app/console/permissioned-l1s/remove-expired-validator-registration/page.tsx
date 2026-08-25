import RemoveExpiredValidatorRegistration from "@/components/toolbox/console/permissioned-l1s/remove-expired-registration/RemoveExpiredValidatorRegistration";
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/remove-expired-validator-registration", "Remove Expired Registration");

export default function Page() {
  return (
    <RemoveExpiredValidatorRegistration />
  );
}
