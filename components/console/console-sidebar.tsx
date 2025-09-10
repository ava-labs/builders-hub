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
  Shield,
  Network,
  GitMerge,
  Server,
  Telescope,
  ArrowLeftRight,
  Calculator,
  Coins,
  Box,
  Globe,
  ArrowUpDown,
  ShieldCheck,
  ShieldUser,
  SquareTerminal,
  Hexagon,
  SlidersVertical,
  SquareMinus,
  SquarePlus,
  HandCoins
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
} from "@/components/ui/sidebar";
import { AvalancheLogo } from "@/components/navigation/avalanche-logo";
import { CONSOLE_TOOL_GROUPS } from "@/constants/console-tools";

const iconComponents: Record<string, any> = {
  network: Network,
  box: Box,
  messagesSquare: MessagesSquare,
  wrench: Wrench,
  droplets: Droplets,
  arrowLeft: ArrowLeft,
  shield: Shield,
  gitMerge: GitMerge,
  server: Server,
  telescope: Telescope,
  arrowLeftRight: ArrowLeftRight,
  calculator: Calculator,
  coins: Coins,
  globe: Globe,
  arrowUpDown: ArrowUpDown,
  shieldCheck: ShieldCheck,
  shieldUser: ShieldUser,
  squareTerminal: SquareTerminal,
  hexagon: Hexagon,
  slidersVertical: SlidersVertical,
  squareMinus: SquareMinus,
  squarePlus: SquarePlus,
  handCoins: HandCoins,
  layers: Layers,
};

// Navigation data structure matching user specification
const data = {
  navMain: [
    {
      title: "Home",
      url: "/console",
      icon: Home,
    },
    {
        title: "Back to Builder Hub",
        url: "/",
        icon: ArrowLeft,
      },
  ],
  navGroups: CONSOLE_TOOL_GROUPS.map((group) => ({
    title: group.title,
    icon: iconComponents[group.icon] ?? Box,
    items: group.items.map((item) => ({
      title: item.title,
      url: item.externalUrl ? item.externalUrl : (item.path ? `/console/${item.path}` : '#'),
      icon: iconComponents[item.icon] ?? Wrench,
      comingSoon: item.comingSoon,
    })),
  })),
  navSecondary: [],
};

interface ConsoleSidebarProps extends React.ComponentProps<typeof Sidebar> {}

export function ConsoleSidebar({ 
  ...props 
}: ConsoleSidebarProps) {
  const pathname = usePathname();
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <Link
          href="/console"
          className="flex items-center gap-2 group transition-all duration-200 p-2"
        >
          <AvalancheLogo className='size-7' fill='currentColor' />
          <span className="font-large font-semibold">Builder Console</span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarMenu>
            {data.navMain.map((item) => {
              const isActive = pathname === item.url;
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive}
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* Flat Navigation Groups */}
        {data.navGroups.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>
              <span>{group.title}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url;
                  const isComingSoon = 'comingSoon' in item && (item as any).comingSoon;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild
                        isActive={isActive}
                        className={`${isComingSoon ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isComingSoon}
                      >

                        
                        {isComingSoon ? (
                          <Link href="#">
                            <item.icon />
                            <span>{item.title} (soon)</span>
                          </Link>
                        ) : (
                          <Link href={item.url}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        )}
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

// Export the navigation data for use in other components
export { data };