import DepositClientPage from './client-page';

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <DepositClientPage currentStepKey={step} />;
}
