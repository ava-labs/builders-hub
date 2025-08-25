"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
import { data } from "./console-sidebar";


interface AcademySidebarProps extends React.ComponentProps<typeof Sidebar> {}

export function AcademySidebar({ 
  ...props 
}: AcademySidebarProps) {
  const pathname = usePathname();
  return (
    <Sidebar 
      variant="sidebar" 
      collapsible="offcanvas" 
      className="not-prose absolute top-[var(--header-height)] left-0 right-0 bottom-0 z-50" 
      {...props}>
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