import SetAuditor from '@/components/toolbox/console/encrypted-erc/deploy/SetAuditor';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/encrypted-erc", "Encrypted ERC");

export default function Page() {
  return <SetAuditor />;
}
