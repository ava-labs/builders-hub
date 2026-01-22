"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Layers,
  MessagesSquare,
  Wrench,
  Droplets,
  ArrowLeft,
  Server,
  ArrowLeftRight,
  Calculator,
  Coins,
  Globe,
  ArrowUpDown,
  SquareTerminal,
  ExternalLink,
  BookKey,
  Activity,
  ChevronRight,
  Sparkles,
  Shield,
  Users,
  Workflow,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Cleaner navigation structure
const navigation = {
  main: [
    { title: "Home", url: "/console", icon: Home },
    { title: "Back to Builder Hub", url: "/", icon: ArrowLeft },
  ],
  groups: [
    {
      title: "Get Started",
      items: [
        { title: "Blueprints", url: "/console/blueprints", icon: Sparkles },
        { title: "Create L1", url: "/console/layer-1/create", icon: Layers },
        { title: "Testnet Faucet", url: "/console/primary-network/faucet", icon: Droplets },
      ],
    },
    {
      title: "Primary Network",
      items: [
        { title: "Data API Keys", url: "/console/utilities/data-api-keys", icon: BookKey },
        { title: "Node Setup", url: "/console/primary-network/node-setup", icon: Server },
        { title: "Stake", url: "/console/primary-network/stake", icon: Coins },
        { title: "C/P Bridge", url: "/console/primary-network/c-p-bridge", icon: ArrowLeftRight },
        { title: "Ethereum Bridge", url: "https://core.app/bridge", icon: ArrowUpDown, external: true },
        { title: "Unit Converter", url: "/console/primary-network/unit-converter", icon: Calculator },
      ],
    },
    {
      title: "Your L1",
      items: [
        { title: "Node Setup", url: "/console/layer-1/l1-node-setup", icon: Server },
        { title: "Explorer Setup", url: "/console/layer-1/explorer-setup", icon: Globe },
        { title: "Performance", url: "/console/layer-1/performance-monitor", icon: Activity },
        { title: "Validator Balance", url: "/console/layer-1/l1-validator-balance", icon: Coins },
        {
          title: "Validators",
          icon: Users,
          children: [
            { title: "Query Validator Set", url: "/console/layer-1/validator-set" },
            { title: "Validator Manager Setup", url: "/console/permissioned-l1s/validator-manager-setup" },
            { title: "Multisig Setup", url: "/console/permissioned-l1s/multisig-setup" },
            { title: "Add Validator", url: "/console/permissioned-l1s/add-validator" },
            { title: "Remove Validator", url: "/console/permissioned-l1s/remove-validator" },
            { title: "Disable Validator", url: "/console/permissioned-l1s/disable-validator" },
            { title: "Change Weight", url: "/console/permissioned-l1s/change-validator-weight" },
            { title: "Remove Expired", url: "/console/permissioned-l1s/remove-expired-validator-registration" },
            { title: "Native Staking Setup", url: "/console/permissionless-l1s/native-staking-manager-setup" },
          ],
        },
        {
          title: "Tokenomics",
          icon: Coins,
          children: [
            { title: "Fee Parameters", url: "/console/l1-tokenomics/fee-manager" },
            { title: "Fee Distribution", url: "/console/l1-tokenomics/reward-manager" },
            { title: "Mint Native Coins", url: "/console/l1-tokenomics/native-minter" },
          ],
        },
        {
          title: "Access Control",
          icon: Shield,
          children: [
            { title: "Deployer Allowlist", url: "/console/l1-access-restrictions/deployer-allowlist" },
            { title: "Transactor Allowlist", url: "/console/l1-access-restrictions/transactor-allowlist" },
          ],
        },
      ],
    },
    {
      title: "Cross-Chain",
      items: [
        { title: "ICM Setup", url: "/console/icm/setup", icon: MessagesSquare },
        { title: "ICM Test", url: "/console/icm/test-connection", icon: MessagesSquare },
        { title: "ICTT Bridge Setup", url: "/console/ictt/setup", icon: Workflow },
        { title: "Token Transfer", url: "/console/ictt/token-transfer", icon: ArrowLeftRight },
      ],
    },
    {
      title: "Testnet Infra",
      items: [
        { title: "Nodes", url: "/console/testnet-infra/nodes", icon: Server },
        { title: "ICM Relayer", url: "/console/testnet-infra/icm-relayer", icon: Workflow },
      ],
    },
    {
      title: "Utilities",
      items: [
        { title: "Format Converter", url: "/console/utilities/format-converter", icon: Wrench },
        { title: "Transfer Proxy Admin", url: "/console/utilities/transfer-proxy-admin", icon: Wrench },
        { title: "VMC Migration", url: "/console/utilities/vmcMigrateFromV1", icon: Wrench },
        { title: "Revert PoA Manager", url: "/console/utilities/revert-poa-manager", icon: Wrench },
      ],
    },
  ],
};

interface ConsoleSidebarProps extends React.ComponentProps<typeof Sidebar> {}

export function ConsoleSidebar({ ...props }: ConsoleSidebarProps) {
  const pathname = usePathname();

  const isActive = (url: string) => pathname === url || pathname.startsWith(url + '/');

  const hasActiveChild = (children: { url: string }[]) =>
    children.some(child => isActive(child.url));

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link
          href="/console"
          className="flex items-center gap-2 p-2 transition-colors hover:opacity-80"
        >
          <AvalancheLogo className="size-6" fill="currentColor" />
          <span className="font-semibold">Console</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Main nav */}
        <SidebarGroup>
          <SidebarMenu>
            {navigation.main.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild isActive={pathname === item.url}>
                  <Link href={item.url}>
                    <item.icon className="size-4" />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Grouped nav */}
        {navigation.groups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  // Item with children (collapsible)
                  if ('children' in item && item.children) {
                    const isOpen = hasActiveChild(item.children);
                    return (
                      <Collapsible key={item.title} defaultOpen={isOpen}>
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton>
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {item.children.map((child) => (
                                <SidebarMenuSubItem key={child.title}>
                                  <SidebarMenuSubButton asChild isActive={isActive(child.url)}>
                                    <Link href={child.url}>{child.title}</Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  }

                  // External link
                  if ('external' in item && item.external) {
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <a href={item.url} target="_blank" rel="noopener noreferrer">
                            <item.icon className="size-4" />
                            <span>{item.title}</span>
                            <ExternalLink className="ml-auto size-3 opacity-50" />
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  // Regular link
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link href={item.url}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

export { navigation as data };
