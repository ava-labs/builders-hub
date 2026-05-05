import CreateL1StepClientPage from './client-page';

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <CreateL1StepClientPage currentStepKey={step} />;
}
