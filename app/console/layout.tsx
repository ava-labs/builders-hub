"use client";

import { ReactNode } from "react"
import { ConsoleSidebar } from "./components/console-sidebar"
import { SiteHeader } from "./components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { SessionProvider } from "next-auth/react"

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <ConsoleSidebar variant="inset" />
        <SidebarInset className="bg-background">
          <SiteHeader />
          <div className="flex flex-1 flex-col gap-4 p-8">
              {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  )
}