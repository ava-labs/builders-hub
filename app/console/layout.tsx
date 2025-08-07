import { ReactNode } from "react"
import { ConsoleSidebar } from "./components/console-sidebar"
import { SiteHeader } from "./components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <ConsoleSidebar variant="inset" />
      <SidebarInset className="bg-white">
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4">
            {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}