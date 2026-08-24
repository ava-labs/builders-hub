import { redirect } from 'next/navigation';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/icm/setup", "ICM Setup");

export default function Page() {
  redirect('/console/icm/messenger');
}
