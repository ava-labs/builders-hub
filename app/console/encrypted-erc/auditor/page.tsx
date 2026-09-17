import AuditorView from '@/components/toolbox/console/encrypted-erc/AuditorView';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/encrypted-erc", "Encrypted ERC");

export default function Page() {
  return <AuditorView />;
}
