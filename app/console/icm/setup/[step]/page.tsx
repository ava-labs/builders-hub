import { redirect } from 'next/navigation';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/icm/setup", "ICM Setup");

const LEGACY_TO_PHASE: Record<string, string> = {
  'icm-messenger': 'messenger',
  'icm-registry': 'registry',
  'icm-relayer-type': 'relayer',
  'self-hosted-relayer': 'relayer',
  'managed-testnet-relayer': 'relayer',
  'deploy-icm-demo': 'demo',
  'send-icm-demo-message': 'live',
};

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const phase = LEGACY_TO_PHASE[step] ?? 'messenger';
  redirect(`/console/icm/${phase}`);
}
