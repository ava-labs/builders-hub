import { redirect } from 'next/navigation';

export default function Page() {
  // Send users directly into the Deploy-Your-Own wizard — the old
  // standalone/converter split was replaced by a single wizard that asks the
  // mode in step 1.
  redirect('/console/encrypted-erc/deploy/configure');
}
