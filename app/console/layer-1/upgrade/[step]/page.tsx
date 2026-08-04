import L1UpgradeClientPage from './client-page';

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <L1UpgradeClientPage currentStepKey={step} />;
}
