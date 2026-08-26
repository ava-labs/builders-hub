import Overview from '@/components/toolbox/console/encrypted-erc/overview';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/encrypted-erc", "Encrypted ERC");

export default function Page() {
  return <Overview />;
}
