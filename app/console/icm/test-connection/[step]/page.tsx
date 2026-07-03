import { redirect } from 'next/navigation';

const LEGACY_TO_PHASE: Record<string, string> = {
  'deploy-icm-demo': 'demo',
  'send-icm-demo-message': 'live',
};

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const phase = LEGACY_TO_PHASE[step] ?? 'demo';
  redirect(`/console/icm/${phase}`);
}
