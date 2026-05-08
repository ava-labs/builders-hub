import { redirect } from 'next/navigation';

const STEP_TO_PHASE: Record<string, string> = {
  'deploy-test-erc20': 'token',
  'deploy-wrapped-native': 'token',
  'deploy-source-token': 'token',
  'deploy-token-home': 'home',
  'deploy-remote': 'remote',
  'erc20-remote': 'remote',
  'native-remote': 'remote',
  'register-with-home': 'register',
  'add-collateral': 'collateral',
};

// Legacy per-step routes (deploy-test-erc20, deploy-token-home, …) now
// 301-redirect to the unified bridge console with the corresponding
// phase preselected. Maps to the new phase IDs in `_components/types.ts`.
export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const phase = STEP_TO_PHASE[step];
  redirect(phase ? `/console/ictt?phase=${phase}` : '/console/ictt');
}
