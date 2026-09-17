'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/console/layer-1/upgrade/select-l1');
  }, [router]);

  return null;
}
