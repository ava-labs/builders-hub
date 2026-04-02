"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ConsoleSidebar } from "../../components/console/console-sidebar";
import { SiteHeader } from "../../components/console/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { useAutomatedFaucet } from "@/hooks/useAutomatedFaucet";
import { useRetroactiveConsoleBadges } from "@/hooks/useRetroactiveConsoleBadges";
import { TrackNewUser } from "@/components/analytics/TrackNewUser";
import { LoginModalWrapper } from "@/components/login/LoginModalWrapper";
import { OnboardingTour } from "@/components/console/onboarding-tour";
import { WelcomeModal } from "@/components/console/onboarding-tour/welcome-modal";
import { ConsoleBadgeNotification } from "@/components/console/ConsoleBadgeNotification";
import { LayoutWrapper } from "@/app/layout-wrapper.client";
import { baseOptions } from "@/app/layout.config";
import { NavbarDropdownInjector } from "@/components/navigation/navbar-dropdown-injector";
import Script from "next/script";

function ConsolePageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
    >
      {children}
    </motion.div>
  );
}

function ConsoleContent({ children }: { children: ReactNode }) {
  useAutomatedFaucet();
  useRetroactiveConsoleBadges();

  // The main navbar is h-14 (3.5rem). All height calcs subtract it alongside the banner.
  const viewportHeight = "calc(100vh - 3.5rem - var(--fd-banner-height,0px))";

  return (
    <WalletProvider>
      <LayoutWrapper baseOptions={baseOptions}>
        <NavbarDropdownInjector />
        <SidebarProvider
          className="!overflow-hidden"
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
              height: viewportHeight,
              minHeight: viewportHeight,
              maxHeight: viewportHeight,
            } as React.CSSProperties
          }
        >
          <ConsoleSidebar variant="inset" />
          <SidebarInset
            className="bg-white dark:bg-zinc-900 overflow-hidden m-2 flex flex-col"
            style={{ height: `calc(${viewportHeight} - 1rem)` }}
          >
            <SiteHeader />
            <div className="flex flex-1 flex-col gap-4 p-8 overflow-y-auto min-h-0">
              <ConsolePageTransition>{children}</ConsolePageTransition>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </LayoutWrapper>
      <Toaster position="bottom-right" richColors expand={true} visibleToasts={5}/>
      <ConsoleBadgeNotification />
      <OnboardingTour />
      <WelcomeModal />
    </WalletProvider>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <TrackNewUser />
      {/* Temporary: Figma capture script for design export — remove after capture */}
      <Script src="https://mcp.figma.com/mcp/html-to-design/capture.js" strategy="afterInteractive" />
      <ConsoleContent>{children}</ConsoleContent>
      <LoginModalWrapper />
    </SessionProvider>
  );
}
