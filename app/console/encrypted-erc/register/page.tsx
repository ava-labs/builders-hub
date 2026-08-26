import Register from '@/components/toolbox/console/encrypted-erc/Register';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/encrypted-erc", "Encrypted ERC");

export default function Page() {
  return <Register />;
}
