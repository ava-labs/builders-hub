"use client";

import { ReactNode, useEffect, Suspense } from "react";
import { ConsoleSidebar } from "../../components/console/console-sidebar";
import { SiteHeader } from "../../components/console/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SessionProvider, useSession } from "next-auth/react";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { useAutomatedFaucet } from "@/hooks/useAutomatedFaucet";
import { useSearchParams } from "next/navigation";
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

function ConsoleContent({ children }: { children: ReactNode }) {
  useAutomatedFaucet();

  return (
    <WalletProvider>
      <SidebarProvider
        className="h-screen overflow-hidden"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <ConsoleSidebar variant="inset" />
        <SidebarInset className="bg-white dark:bg-gray-800 h-[calc(100vh-1rem)] overflow-hidden m-2">
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-8 overflow-y-auto h-[calc(100vh-var(--header-height)-1rem)]">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" richColors expand={true} visibleToasts={5}/>
    </WalletProvider>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TrackNewUser />
      <ConsoleContent>{children}</ConsoleContent>
    </SessionProvider>
  );
}
