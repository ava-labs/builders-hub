"use client";

import { ReactNode } from "react";
import { ConsoleSidebar } from "../../components/console/console-sidebar";
import { SiteHeader } from "../../components/console/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <WalletProvider>
        <SidebarProvider
          className="h-screen overflow-hidden"
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <ConsoleSidebar variant="inset" />
          <SidebarInset className="bg-white dark:bg-gray-800 h-[calc(100vh-1rem)] overflow-hidden m-2">
            <SiteHeader />
            <div className="flex-1 flex flex-col gap-4 p-8 overflow-hidden h-[calc(100vh-var(--header-height)-1rem)]">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster position="bottom-right" richColors expand={true} visibleToasts={5} />
      </WalletProvider>
    </SessionProvider>
  );
}
