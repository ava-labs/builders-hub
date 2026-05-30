import { ReactNode } from "react";

interface ExplorerRootLayoutProps {
  children: ReactNode;
}

export default function ExplorerRootLayout({ children }: ExplorerRootLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}

