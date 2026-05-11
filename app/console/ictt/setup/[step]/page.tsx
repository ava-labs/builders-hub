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

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const phase = STEP_TO_PHASE[step] ?? 'token';
  redirect(`/console/ictt/${phase}`);
}
