import PrivateTransfer from '@/components/toolbox/console/encrypted-erc/PrivateTransfer';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/encrypted-erc", "Encrypted ERC");

export default function Page() {
  return <PrivateTransfer />;
}
