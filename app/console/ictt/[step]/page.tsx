import { redirect } from 'next/navigation';
import { isValidBridgeStep } from '@/components/toolbox/console/ictt/bridge/bridge-steps';
import IcttBridgeStepClientPage from './client-page';

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  if (!isValidBridgeStep(step)) {
    redirect('/console/ictt/token');
  }
  return <IcttBridgeStepClientPage currentStep={step} />;
}
