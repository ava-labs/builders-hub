import { ReactNode } from "react";

interface ExplorerLayoutProps {
  children: ReactNode;
}

export default function ExplorerRouteLayout({ children }: ExplorerLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}

