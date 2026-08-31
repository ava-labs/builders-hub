import { redirect } from 'next/navigation';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/ictt", "Interchain Token Transfer");

type SearchParams = { phase?: string; remote?: string };

const VALID_STEPS = new Set(['token', 'home', 'remote', 'register', 'collateral', 'live']);

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { phase, remote } = await searchParams;
  const step = phase && VALID_STEPS.has(phase) ? phase : 'token';
  const query = remote ? `?remote=${encodeURIComponent(remote)}` : '';
  redirect(`/console/ictt/${step}${query}`);
}
