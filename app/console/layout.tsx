"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ConsoleSidebar } from "../../components/console/console-sidebar";
import { SiteHeader } from "../../components/console/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SessionProvider } from "next-auth/react";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { useAutomatedFaucet } from "@/hooks/useAutomatedFaucet";
import { useRetroactiveConsoleBadges } from "@/hooks/useRetroactiveConsoleBadges";
import { TrackNewUser } from "@/components/analytics/TrackNewUser";
import { LoginModalWrapper } from "@/components/login/LoginModalWrapper";
import { OnboardingTour } from "@/components/console/onboarding-tour";
import { WelcomeModal } from "@/components/console/onboarding-tour/welcome-modal";
import { ConsoleBadgeNotification } from "@/components/console/ConsoleBadgeNotification";
import { ConsoleViewport } from "@/components/console/console-viewport";
import { LayoutWrapper } from "@/app/layout-wrapper.client";
import { baseOptions } from "@/app/layout.config";
import { NavbarDropdownInjector } from "@/components/navigation/navbar-dropdown-injector";
import { StepErrorBoundary } from "@/components/toolbox/components/StepErrorBoundary";
import { CommandPalette } from "@/components/console/command-palette";

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

  return (
    <WalletProvider>
      <LayoutWrapper baseOptions={baseOptions}>
        <NavbarDropdownInjector />
        <ConsoleViewport>
          <SidebarProvider
            className="!overflow-hidden"
            style={
              {
                "--sidebar-width": "calc(var(--spacing) * 72)",
                "--header-height": "calc(var(--spacing) * 12)",
                height: "var(--console-viewport)",
                minHeight: "var(--console-viewport)",
                maxHeight: "var(--console-viewport)",
              } as React.CSSProperties
            }
          >
            <ConsoleSidebar variant="inset" />
            <SidebarInset
              className="bg-white dark:bg-zinc-900 overflow-hidden m-2"
              style={{ height: "calc(var(--console-viewport) - 1rem)" }}
            >
              <SiteHeader />
              <div
                className="flex flex-1 flex-col gap-4 p-4 md:p-8 overflow-y-auto"
                style={{
                  height:
                    "calc(var(--console-viewport) - var(--header-height) - 1rem)",
                }}
              >
                <StepErrorBoundary fallbackMessage="Something went wrong rendering this page. The console sidebar is still available — try navigating to a different tool.">
                  <ConsolePageTransition>{children}</ConsolePageTransition>
                </StepErrorBoundary>
              </div>
            </SidebarInset>
            <CommandPalette />
          </SidebarProvider>
        </ConsoleViewport>
      </LayoutWrapper>
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
      <ConsoleContent>{children}</ConsoleContent>
      <LoginModalWrapper />
    </SessionProvider>
  );
}
