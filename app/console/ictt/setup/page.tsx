import { redirect } from 'next/navigation';

// Legacy entry — bridge setup is now folded into the unified
// /console/ictt page. We preserve this route as a 301 to avoid breaking
// any external links that pointed at the old setup wizard.
export default function Page() {
  redirect('/console/ictt');
}
