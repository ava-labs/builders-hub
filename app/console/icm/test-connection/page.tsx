import { redirect } from 'next/navigation';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/icm/test-connection", "ICM Test Connection");

export default function Page() {
  redirect('/console/icm/demo');
}
