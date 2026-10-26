"use client";

import { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
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

/**
 * con-tool-switch: one 150ms fade when a tool or a step opens, and nothing moves. A CSS animation, so it runs while the
 * route renders and needs no script to show the page. Opacity only, so Reduce Motion keeps it: the reducer in
 * app/global.css would play it in 1ms.
 */
const PAGE_FADE = "animate-[vs-fade-in_150ms_var(--ease-out)] motion-reduce:[animation-duration:150ms]!";

/**
 * Step flows that render from a layout above their [step] route (stepFlowLayout, con-step-travel): the flow stays
 * mounted from step to step and animates the change itself, so the pane fades once when the flow opens, not on every
 * step. Only a [step] route shares its flow's key: a sibling page under a base (create-l1/basic) keeps its own.
 * The ICTT bridge (/console/ictt/[step]) is not one of them: it still mounts with each step.
 */
const MOUNTED_FLOWS = [
  "/console/add-validator/",
  "/console/create-l1/",
  "/console/encrypted-erc/deploy/",
  "/console/encrypted-erc/deposit/",
  "/console/layer-1/create/",
  "/console/layer-1/upgrade/",
  "/console/permissioned-l1s/change-validator-weight/",
  "/console/permissioned-l1s/multisig-setup/",
  "/console/permissioned-l1s/validator-manager-setup/",
  "/console/permissionless-l1s/delegate/erc20/",
  "/console/permissionless-l1s/delegate/native/",
  "/console/permissionless-l1s/erc20-staking-manager-setup/",
  "/console/permissionless-l1s/native-staking-manager-setup/",
  "/console/permissionless-l1s/remove-delegation/",
  "/console/permissionless-l1s/submit-uptime-proof/",
  "/console/remove-validator/",
  "/console/utilities/vmcMigrateFromV1/",
];

function ConsolePageTransition({ children, fill }: { children: ReactNode; fill: boolean }) {
  const pathname = usePathname();
  const { step } = useParams<{ step?: string }>();
  const flow = step === undefined ? undefined : MOUNTED_FLOWS.find((base) => pathname === `${base}${step}`);

  return (
    <div key={flow ?? pathname} className={cn(PAGE_FADE, fill && "flex flex-col lg:min-h-0 lg:flex-1")}>
      {children}
    </div>
  );
}

/** Pages that fit between the header and the footer and scroll inside their own panes. */
const FILL_ROUTES = [/^\/console\/studio\/[^/]+$/];

/**
 * Runs the automated faucet in a leaf. The hook reads the whole wallet store, so its component renders again on each
 * wallet store write. In ConsoleContent, that render also rendered WalletProvider and wagmi's Hydrate again. With
 * `ssr: false`, Hydrate calls reconnect() in each render, and the reconnect updated ConnectModal and WalletSync
 * during that render: React's "Cannot update a component while rendering a different component" warning.
 */
function AutomatedFaucet() {
  useAutomatedFaucet();
  return null;
}

function ConsoleContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const fill = FILL_ROUTES.some((route) => route.test(pathname));

  return (
    <WalletProvider>
      <AutomatedFaucet />
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
                <StepErrorBoundary fallbackMessage="Something went wrong while this page rendered. The console sidebar still works: open a different tool.">
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
