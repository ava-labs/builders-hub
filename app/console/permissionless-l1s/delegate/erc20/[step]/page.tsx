import DelegateERC20ClientPage from "./client-page";

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <DelegateERC20ClientPage currentStepKey={step} />;
}
