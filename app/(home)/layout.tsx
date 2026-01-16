"use client";

import type { ReactNode } from "react";
import { Footer } from "@/components/navigation/footer";
import { baseOptions } from "@/app/layout.config";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutWrapper } from "@/app/layout-wrapper.client";
import { NavbarDropdownInjector } from "@/components/navigation/navbar-dropdown-injector";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { TrackNewUser } from "@/components/analytics/TrackNewUser";
import { AutoLoginModalTrigger } from "@/components/login/AutoLoginModalTrigger";
import { LoginModalWrapper } from "@/components/login/LoginModalWrapper";

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      <TrackNewUser />
      <NavbarDropdownInjector />
      <WalletProvider>
        <LayoutWrapper baseOptions={baseOptions}>
          {children}
          <Footer />
        </LayoutWrapper>
        <AutoLoginModalTrigger />
        <LoginModalWrapper />
      </WalletProvider>
    </SessionProvider>
  );
}


