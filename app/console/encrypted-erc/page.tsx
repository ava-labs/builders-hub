import { redirect } from 'next/navigation';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/encrypted-erc", "Encrypted ERC");

export default function Page() {
  redirect('/console/encrypted-erc/overview');
}
