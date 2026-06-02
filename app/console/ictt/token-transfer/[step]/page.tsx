import { redirect } from 'next/navigation';

const STEP_TO_PHASE: Record<string, string> = {
  'add-collateral': 'collateral',
  'test-send': 'live',
};

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const phase = STEP_TO_PHASE[step] ?? 'live';
  redirect(`/console/ictt/${phase}`);
}
