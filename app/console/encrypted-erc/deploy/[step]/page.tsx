import DeployClientPage from './client-page';

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <DeployClientPage currentStepKey={step} />;
}
