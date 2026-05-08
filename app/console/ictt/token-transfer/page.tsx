import { redirect } from 'next/navigation';

// Legacy entry — token transfer is now folded into the unified
// /console/ictt page (Live phase). 301 to preserve any old links.
export default function Page() {
  redirect('/console/ictt?phase=transfer');
}
