import RemoveLegacyValidators from '@/components/toolbox/console/permissioned-l1s/remove-legacy-validators/RemoveLegacyValidators';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/permissioned-l1s/remove-legacy-validators", "Remove Legacy Validators");

export default function RemoveLegacyValidatorsPage() {
  return <RemoveLegacyValidators />;
}
