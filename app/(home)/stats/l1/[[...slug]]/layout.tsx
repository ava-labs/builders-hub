import { ReactNode } from "react";

interface L1StatsLayoutProps {
  children: ReactNode;
}

export default function L1StatsLayout({ children }: L1StatsLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
