import { ReactNode } from "react";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { LinkWarmer } from "@/components/explorer-v2/link-warmer";

interface ExplorerRootLayoutProps {
  children: ReactNode;
}

export default function ExplorerRootLayout({ children }: ExplorerRootLayoutProps) {
  return (
    <WalletProvider>
      <div className="min-h-screen bg-white">
        {children}
      </div>
      <LinkWarmer />
    </WalletProvider>
  );
}
