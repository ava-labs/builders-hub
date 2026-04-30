import RegisterClientPage from './client-page';

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <RegisterClientPage currentStepKey={step} />;
}
