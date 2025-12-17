"use client";

import { ReactNode, useEffect, Suspense } from 'react';
import { Footer } from '@/components/navigation/footer';
import { baseOptions } from '@/app/layout.config';
import { SessionProvider, useSession } from 'next-auth/react';
import { LayoutWrapper } from '@/app/layout-wrapper.client';
import { NavbarDropdownInjector } from '@/components/navigation/navbar-dropdown-injector';
import { useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';

function TrackNewUserLogic() {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (status === "authenticated" && session.user.is_new_user) {
      const trackingKey = `posthog_user_created_${session.user.id}`;
      if (typeof window !== "undefined" && !localStorage.getItem(trackingKey)) {
        posthog.identify(session.user.id, {
          email: session.user.email,
          name: session.user.name,
        });
        posthog.capture('user_created', {
          auth_provider: session.user.authentication_mode,
          utm_source: searchParams.get('utm_source') || undefined,
          utm_medium: searchParams.get('utm_medium') || undefined,
          utm_campaign: searchParams.get('utm_campaign') || undefined,
          utm_content: searchParams.get('utm_content') || undefined,
          utm_term: searchParams.get('utm_term') || undefined,
          referrer: document.referrer || undefined,
        });
        localStorage.setItem(trackingKey, 'true');
      }
    }
  }, [session, status, searchParams]);

  return null;
}

function TrackNewUser() {
  return (
    <Suspense fallback={null}>
      <TrackNewUserLogic />
    </Suspense>
  );
}

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      <TrackNewUser />
      <LayoutWrapper baseOptions={baseOptions}>
        <NavbarDropdownInjector />
        {children}
        <Footer />
      </LayoutWrapper>
    </SessionProvider>
  );
}
