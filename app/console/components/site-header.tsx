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
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { routeMetadata } from "../route-metadata";
const TestnetMainnetSwitch = dynamic(() => import("@console-header/testnet-mainnet-switch").then(m => m.TestnetMainnetSwitch), { ssr: false });
const WalletPChain = dynamic(() => import("@console-header/pchain-wallet").then(m => m.WalletPChain), { ssr: false });
const EvmNetworkWallet = dynamic(() => import("@console-header/evm-network-wallet/index").then(m => m.EvmNetworkWallet), { ssr: false });
const DarkModeToggle = dynamic(() => import("@console-header/dark-mode-toggle").then(m => m.DarkModeToggle), { ssr: false });
const WalletBootstrap = dynamic(() => import("@console-header/wallet-bootstrap").then(m => m.WalletBootstrap), { ssr: false });
import { BuilderHubAccountButton } from "./builder-hub-account-button";



export function SiteHeader() {
  const breadcrumbs = useBreadcrumbs(routeMetadata);

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
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
              <div key={breadcrumb.href} className="flex items-center">
                <BreadcrumbItem className="hidden md:block">
                  {breadcrumb.isCurrentPage ? (
                    <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
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
          <DarkModeToggle />
          <Separator
          orientation="vertical"
          className="h-4!"
        />
          <BuilderHubAccountButton />
        </div>
      </div>
    </header>
  )
}
