import { redirect } from 'next/navigation';

// Old single-page Deposit got split into a 2-step StepFlow (Wrap AVAX → Deposit)
// so users who only hold native AVAX aren't stuck at an "insufficient WAVAX"
// error. Users with WAVAX already can skip step 1 via the stepper.
export default function Page() {
  redirect('/console/encrypted-erc/deposit/wrap-avax');
}
