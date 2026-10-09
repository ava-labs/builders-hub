"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ConsoleSidebar } from "../../components/console/console-sidebar";
import { SiteHeader } from "../../components/console/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { useAutomatedFaucet } from "@/hooks/useAutomatedFaucet";
import { TrackNewUser } from "@/components/analytics/TrackNewUser";
import { LoginModalWrapper } from "@/components/login/LoginModalWrapper";
import { OnboardingTour } from "@/components/console/onboarding-tour";
import { WelcomeModal } from "@/components/console/onboarding-tour/welcome-modal";
import { ConsoleViewport } from "@/components/console/console-viewport";
import { LayoutWrapper } from "@/app/layout-wrapper.client";
import { baseOptions } from "@/app/layout.config";
import { NavbarDropdownInjector } from "@/components/navigation/navbar-dropdown-injector";
import { StepErrorBoundary } from "@/components/toolbox/components/StepErrorBoundary";
import { CommandPalette } from "@/components/console/command-palette";
import { ConsoleFooter } from "@/components/console/console-footer";
import { cn } from "@/lib/utils";

function ConsolePageTransition({ children, fill }: { children: ReactNode; fill: boolean }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={fill ? "flex flex-col lg:min-h-0 lg:flex-1" : undefined}
    >
      {children}
    </motion.div>
  );
}

/** Pages that fit between the header and the footer and scroll inside their own panes. */
const FILL_ROUTES = [/^\/console\/studio\/[^/]+$/];

function ConsoleContent({ children }: { children: ReactNode }) {
  useAutomatedFaucet();
  const pathname = usePathname();
  const fill = FILL_ROUTES.some((route) => route.test(pathname));

  return (
    <WalletProvider>
      <LayoutWrapper baseOptions={baseOptions}>
        <NavbarDropdownInjector />
        <ConsoleViewport>
          <SidebarProvider
            className="!fixed inset-x-0 bottom-0 z-20 !min-h-0 !overflow-hidden"
            style={
              {
                "--sidebar-width": "calc(var(--spacing) * 72)",
                "--header-height": "calc(var(--spacing) * 12)",
                top: "calc(3.5rem + 1px + var(--fd-banner-height, 0px))",
              } as React.CSSProperties
            }
          >
            <ConsoleSidebar variant="inset" />
            <SidebarInset
              className="m-2 h-[calc(100%-1rem)] min-h-0 overflow-hidden bg-white dark:bg-zinc-900"
            >
              <SiteHeader />
              <div
                data-console-pane
                className={cn(
                  "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain",
                  // Full-height workspaces bring their own inner padding; the page gutter stays narrow around them.
                  fill ? "p-2 md:p-3 lg:overflow-hidden" : "p-4 md:p-8",
                )}
              >
                <StepErrorBoundary fallbackMessage="Something went wrong rendering this page. The console sidebar is still available — try navigating to a different tool.">
                  <ConsolePageTransition fill={fill}>{children}</ConsolePageTransition>
                </StepErrorBoundary>
                <ConsoleFooter />
              </div>
            </SidebarInset>
            <CommandPalette />
          </SidebarProvider>
        </ConsoleViewport>
      </LayoutWrapper>
      <OnboardingTour />
      <WelcomeModal />
    </WalletProvider>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <TrackNewUser />
      <ConsoleContent>{children}</ConsoleContent>
      <LoginModalWrapper />
    </>
  );
}
