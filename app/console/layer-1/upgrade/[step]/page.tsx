import UpgradeL1ClientPage from "./client-page";

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <UpgradeL1ClientPage currentStepKey={step} />;
}
