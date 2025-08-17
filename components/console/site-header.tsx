"use client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import dynamic from "next/dynamic";
import { ThemeToggle } from "fumadocs-ui/components/layout/theme-toggle";

import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { pathToBreadcrumb } from "./breadcrumbs-mapping";
import { BuilderHubAccountButton } from "./builder-hub-account-button";

const TestnetMainnetSwitch = dynamic(() => import("@console-header/testnet-mainnet-switch").then(m => m.TestnetMainnetSwitch), { ssr: false });
const WalletPChain = dynamic(() => import("@console-header/pchain-wallet").then(m => m.WalletPChain), { ssr: false });
const EvmNetworkWallet = dynamic(() => import("@console-header/evm-network-wallet/index").then(m => m.EvmNetworkWallet), { ssr: false });
const WalletBootstrap = dynamic(() => import("@console-header/wallet-bootstrap").then(m => m.WalletBootstrap), { ssr: false });



export function SiteHeader() {
  const breadcrumbs = useBreadcrumbs(pathToBreadcrumb);

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b backdrop-blur  transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) rounded-t-2xl">

      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <WalletBootstrap />
        <SidebarTrigger className="-ml-1" />
        
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((breadcrumb, index) => (
              <div key={`${breadcrumb.href}-${index}`} className="flex items-center">
                <BreadcrumbItem className="hidden md:block">
                  {breadcrumb.isCurrentPage ? (
                    <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                  ) : breadcrumb.href === "#" ? (
                    <span className="text-muted-foreground">{breadcrumb.label}</span>
                  ) : (
                    <BreadcrumbLink href={breadcrumb.href}>
                      {breadcrumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && (
                  <BreadcrumbSeparator className="hidden md:block" />
                )}
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <TestnetMainnetSwitch />
          <EvmNetworkWallet />
          <WalletPChain />
          <Separator
            orientation="vertical"
            className="h-4!"
          />
          <BuilderHubAccountButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
