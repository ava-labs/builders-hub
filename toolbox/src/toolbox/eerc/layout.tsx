import React from "react";
import WagmiWrapper from "./WagmiWrapper";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WagmiWrapper>
      {children}
    </WagmiWrapper>
  );
}
