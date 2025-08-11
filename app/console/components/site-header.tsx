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
import { TestnetMainnetSwitch } from "./testnet-mainnet-switch";
import { SwitchEVMChain } from "./switch-evm-chain";
import { WalletPChain } from "./wallet-p-chain";
import { EVM } from "@avalabs/avalanchejs";
import { EVMWallet } from "./evm-wallet";
import { BuilderHubAccountButton } from "./builder-hub-account-button";



export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="#">
                Building Your Application
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>Data Fetching</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-2">
          <TestnetMainnetSwitch />
          <EVMWallet />
          <SwitchEVMChain />
          <WalletPChain />
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
