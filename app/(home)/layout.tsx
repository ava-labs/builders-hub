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
import { useTrackNewUser } from "@/hooks/useTrackNewUser";

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <RedirectIfNewUser />
      </Suspense>
      <NavbarDropdownInjector />
      <WalletProvider>
        <LayoutWrapper baseOptions={baseOptions}>
          {children}
          <Footer />
        </LayoutWrapper>
      </WalletProvider>
    </SessionProvider>
  );
}

function RedirectIfNewUser() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Track new user in PostHog (shared hook handles deduplication)
  useTrackNewUser();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.is_new_user) {
      // Redirect new users to profile page
      if (pathname !== "/profile") {
        // Store the original URL with search params (including UTM) in localStorage
        const originalUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
        if (typeof window !== "undefined") {
          localStorage.setItem("redirectAfterProfile", originalUrl);
        }
        router.replace("/profile");
      }
    }
  }, [session, status, pathname, router, searchParams]);

  return null;
}
