"use client";

import type { ReactNode } from "react";
import { Footer } from "@/components/navigation/footer";
import { baseOptions } from "@/app/layout.config";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/toast";
import { LayoutWrapper } from "@/app/layout-wrapper.client";
import { NavbarDropdownInjector } from "@/components/navigation/navbar-dropdown-injector";
import { WalletProvider } from "@/components/toolbox/providers/WalletProvider";
import { TrackNewUser } from "@/components/analytics/TrackNewUser";

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <SessionProvider>
      <TrackNewUser />
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

/**
 * Component to redirect new users to the profile page.
 * Tracking is handled separately by TrackNewUser component.
 */
function RedirectIfNewUser() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

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
      
      // Show informative toast and redirect to profile
      toast.info(
        "Complete your profile", 
        "Please fill your profile information to continue. This will help us provide you with a better experience."
      );
      router.replace("/profile");
    }
  }, [session, status, pathname, router, searchParams]);

  return null;
}
