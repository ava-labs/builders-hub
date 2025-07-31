"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { ConsoleLayout } from "./components/ConsoleLayout";

function RedirectIfNewUser() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (
      status === "authenticated" &&
      session.user.is_new_user &&
      pathname !== "/profile"
    ) {
      // Store the original URL with search params (including UTM) in localStorage
      const originalUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("redirectAfterProfile", originalUrl);
      }
      router.replace("/profile");
    }
  }, [session, status, pathname, router, searchParams]);

  return null;
}

function ConsoleDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Welcome to Builder Console</h2>
        <p className="text-muted-foreground">
          Manage your Avalanche L1s, validators, and deployments from one central location.
        </p>
      </div>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-lg border bg-card">
          <h3 className="text-sm font-medium text-muted-foreground">Active L1s</h3>
          <div className="text-2xl font-bold">3</div>
        </div>
        <div className="p-6 rounded-lg border bg-card">
          <h3 className="text-sm font-medium text-muted-foreground">Validators</h3>
          <div className="text-2xl font-bold">12</div>
        </div>
        <div className="p-6 rounded-lg border bg-card">
          <h3 className="text-sm font-medium text-muted-foreground">Deployments</h3>
          <div className="text-2xl font-bold">7</div>
        </div>
        <div className="p-6 rounded-lg border bg-card">
          <h3 className="text-sm font-medium text-muted-foreground">Total Volume</h3>
          <div className="text-2xl font-bold">$2.4M</div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <div>
              <p className="font-medium">L1 "DeFi Chain" deployed successfully</p>
              <p className="text-sm text-muted-foreground">2 hours ago</p>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Success
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
            <div>
              <p className="font-medium">Validator added to "Gaming L1"</p>
              <p className="text-sm text-muted-foreground">5 hours ago</p>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
              Updated
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="font-medium">Contract deployed on "NFT Marketplace L1"</p>
              <p className="text-sm text-muted-foreground">1 day ago</p>
            </div>
            <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              Deployed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <SessionProvider>
      <Suspense fallback={null}>
        <RedirectIfNewUser />
      </Suspense>
      <ConsoleLayout>
        <ConsoleDashboard />
      </ConsoleLayout>
    </SessionProvider>
  );
}
