"use client";

import { ReactNode } from "react";
import { ConsoleSidebar } from "../../components/console/console-sidebar";
import { SiteHeader } from "../../components/console/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { useAutomatedFaucet } from "@/hooks/useAutomatedFaucet";
import { TrackNewUser } from "@/components/analytics/TrackNewUser";
import { LoginModalWrapper } from "@/components/login/LoginModalWrapper";
import { CommandPalette } from "@/components/console/command-palette";
import { OnboardingTour } from "@/components/console/onboarding-tour";
import { WelcomeModal } from "@/components/console/onboarding-tour/welcome-modal";

function ConsoleContent({ children }: { children: ReactNode }) {
  useAutomatedFaucet();

  return (
    <WalletProvider>
      <SidebarProvider
        className="!h-[calc(100vh-var(--fd-banner-height,0px))] !min-h-[calc(100vh-var(--fd-banner-height,0px))] !max-h-[calc(100vh-var(--fd-banner-height,0px))] overflow-hidden"
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <ConsoleSidebar variant="inset" />
        <SidebarInset className="bg-white dark:bg-gray-800 h-[calc(100vh-var(--fd-banner-height,0px)-1rem)] overflow-hidden m-2">
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-8 overflow-y-auto h-[calc(100vh-var(--fd-banner-height,0px)-var(--header-height)-1rem)]">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" richColors expand={true} visibleToasts={5}/>
      <CommandPalette />
      <OnboardingTour />
      <WelcomeModal />
    </WalletProvider>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TrackNewUser />
      <ConsoleContent>{children}</ConsoleContent>
      <LoginModalWrapper />
    </SessionProvider>
  );
}
