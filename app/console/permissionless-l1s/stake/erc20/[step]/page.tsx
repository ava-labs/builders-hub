import StakeERC20ClientPage from "./client-page";

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <StakeERC20ClientPage currentStepKey={step} />;
}
