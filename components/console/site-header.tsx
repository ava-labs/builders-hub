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
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Fragment } from "react";
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs";
import { pathToBreadcrumb } from "./breadcrumbs-mapping";
import { BuilderHubAccountButton } from "./builder-hub-account-button";
import { History } from "lucide-react";
import Link from "next/link";

const TestnetMainnetSwitch = dynamic(() => import("@/components/toolbox/components/console-header/testnet-mainnet-switch").then(m => m.TestnetMainnetSwitch), { ssr: false });
const WalletPChain = dynamic(() => import("@/components/toolbox/components/console-header/pchain-wallet").then(m => m.WalletPChain), { ssr: false });
const EvmNetworkWallet = dynamic(() => import("@/components/toolbox/components/console-header/evm-network-wallet/index").then(m => m.EvmNetworkWallet), { ssr: false });

export function SiteHeader() {
  const breadcrumbs = useBreadcrumbs(pathToBreadcrumb);

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b backdrop-blur  transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) rounded-t-2xl overflow-x-hidden min-w-0">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6 min-w-0">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb className="overflow-hidden min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((breadcrumb, index) => (
              <Fragment key={`${breadcrumb.href}-${index}`}>
                <BreadcrumbItem key={`${breadcrumb.href}-${index}`} className="whitespace-nowrap">
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
                  <BreadcrumbSeparator key={`breadcrumb-separator-${index}`} />
                )}
              </Fragment>
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
          <Link href="/console/history">
            <Button variant="ghost" size="icon" title="Transaction History">
              <History className="h-4 w-4" />
            </Button>
          </Link>
          <BuilderHubAccountButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
