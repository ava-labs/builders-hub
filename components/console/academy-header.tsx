"use client";

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import dynamic from "next/dynamic";

const TestnetMainnetSwitch = dynamic(() => import("@console-header/testnet-mainnet-switch").then(m => m.TestnetMainnetSwitch), { ssr: false });
const WalletPChain = dynamic(() => import("@console-header/pchain-wallet").then(m => m.WalletPChain), { ssr: false });
const EvmNetworkWallet = dynamic(() => import("@console-header/evm-network-wallet/index").then(m => m.EvmNetworkWallet), { ssr: false });
const WalletBootstrap = dynamic(() => import("@console-header/wallet-bootstrap").then(m => m.WalletBootstrap), { ssr: false });

export function AcademyHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b backdrop-blur  transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) rounded-t-2xl">

      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <WalletBootstrap />
        <SidebarTrigger className="-ml-1" />
        
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        
        <span className="text-sm text-muted-foreground">Builder Console</span>
        <div className="ml-auto flex items-center gap-2">
          <TestnetMainnetSwitch />
          <EvmNetworkWallet />
          <WalletPChain />
        </div>
      </div>
    </header>
  )
}
