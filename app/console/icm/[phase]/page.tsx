import { redirect } from 'next/navigation';
import { isValidIcmStep } from '@/components/toolbox/console/icm/network/icm-steps';
import IcmPhaseClientPage from './client-page';
import { consoleToolMetadata } from "@/components/console/tool-metadata";

export const metadata = consoleToolMetadata("/console/icm");

export default async function Page({ params }: { params: Promise<{ phase: string }> }) {
  const { phase } = await params;
  if (!isValidIcmStep(phase)) {
    redirect('/console/icm/messenger');
  }
  return <IcmPhaseClientPage currentPhase={phase} />;
}
