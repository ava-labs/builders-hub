import { redirect } from 'next/navigation';

const STEP_TO_PHASE: Record<string, string> = {
  'add-collateral': 'collateral',
  'test-send': 'transfer',
};

// Legacy per-step routes for token-transfer flow now redirect to the
// unified console. `add-collateral` maps to the Collateral phase;
// `test-send` maps to the Live (transfer) phase.
export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const phase = STEP_TO_PHASE[step];
  redirect(phase ? `/console/ictt?phase=${phase}` : '/console/ictt?phase=transfer');
}
