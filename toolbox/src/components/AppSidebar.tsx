"use client"

import * as React from "react"
import { 
  Home, 
  Layers, 
  Users, 
  MessagesSquare, 
  ArrowUpDown, 
  Settings, 
  Wrench, 
  Droplets, 
  ArrowLeft,
  RefreshCcw,
  ChevronDown,
  Network,
  Building2,
  Zap,
  GitMerge
} from "lucide-react"

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
  SidebarFooter,
  SidebarRail,
} from "../../../components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../../../components/ui/collapsible"

// Navigation data structure with collapsible groups
const data = {
  navMain: [
    {
      title: "Home",
      url: "#home",
      icon: Home,
    },
  ],
  navGroups: [
    {
      title: "Layer 1s",
      icon: Building2,
      isDefaultOpen: true,
      items: [
        {
          title: "Create L1",
          url: "#create-l1",
          icon: Layers,
        },
        {
          title: "Validator Manager",
          url: "#validator-manager",
          icon: Users,
        },
        {
          title: "Precompiles",
          url: "#precompiles",
          icon: Settings,
        },
      ],
    },
    {
      title: "Interoperability",
      icon: GitMerge,
      isDefaultOpen: false,
      items: [
        {
          title: "Interchain Messaging",
          url: "#interchain-messaging",
          icon: MessagesSquare,
        },
        {
          title: "Interchain Token Transfer",
          url: "#interchain-token-transfer", 
          icon: ArrowUpDown,
        },
      ],
    },
    {
      title: "Primary Network",
      icon: Network,
      isDefaultOpen: false,
      items: [
        {
          title: "Cross-Chain Transfer",
          url: "#crossChainTransfer",
          icon: ArrowUpDown,
        },
        {
          title: "Node Setup",
          url: "#avalanchegoDockerPrimaryNetwork",
          icon: Settings,
        },
      ],
    },
    {
      title: "Tools",
      icon: Wrench,
      isDefaultOpen: false,
      items: [
        {
          title: "Utils",
          url: "#utils",
          icon: Zap,
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Faucet",
      url: "#faucet",
      icon: Droplets,
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeItem: string
  onItemSelect: (itemId: string) => void
}

export function AppSidebar({ 
  activeItem, 
  onItemSelect, 
  ...props 
}: AppSidebarProps) {
  // Removed unused getActiveCategory function

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center justify-between px-2 py-2">
          <button
            onClick={() => onItemSelect("home")}
            className="flex flex-col items-center gap-2 group transition-all duration-200"
          >
            <div className="relative">
              <img 
                src="/logo-white.png" 
                alt="Avalanche" 
                className="h-8 w-auto hidden dark:block transition-all duration-200" 
              />
              <img 
                src="/logo-black.png" 
                alt="Avalanche" 
                className="h-8 w-auto block dark:hidden transition-all duration-200" 
              />
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="text-xs font-medium text-muted-foreground">Developer Console</span>
            </div>
          </button>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => {
              const itemId = item.url.replace('#', '')
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    isActive={activeItem === itemId}
                    onClick={() => onItemSelect(itemId)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Collapsible Grouped Navigation */}
        {data.navGroups.map((group) => (
          <Collapsible key={group.title} defaultOpen={group.isDefaultOpen} className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md p-1 text-sm font-medium hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&[data-state=open]>svg]:rotate-180">
                  <div className="flex items-center gap-2">
                    <group.icon className="h-4 w-4" />
                    <span>{group.title}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const itemId = item.url.replace('#', '')
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            isActive={activeItem === itemId}
                            onClick={() => onItemSelect(itemId)}
                            className="pl-6"
                          >
                            <item.icon />
                            <span>{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      )
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        ))}

        {/* Secondary Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            {data.navSecondary.map((item) => {
              const itemId = item.url.replace('#', '')
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    isActive={activeItem === itemId}
                    onClick={() => onItemSelect(itemId)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="/" className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300">
                <ArrowLeft />
                <span>Back to Builder Hub</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => window.location.reload()}>
              <RefreshCcw />
              <span>Reset State</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      
      <SidebarRail />
    </Sidebar>
  )
}

// Export the navigation data for use in other components
export { data } 