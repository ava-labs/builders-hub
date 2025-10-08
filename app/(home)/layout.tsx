"use client";

import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { Footer } from "@/components/navigation/footer";
import { baseOptions } from "@/app/layout.config";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { toast } from "sonner";

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
      <HomeLayout {...baseOptions}>
        {children}
        <Footer />
      </HomeLayout>
    </SessionProvider>
  );
}

// Helper function to check if a cookie exists
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  
  return null;
}

function RedirectIfNewUser() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);

  // useEffect #1: Handle external token authentication
  useEffect(() => {
    const fetchExternalToken = async () => {
      if (status !== "authenticated" || !session?.user?.email) return;

      // Check if the external token cookie already exists
      const externalToken = getCookie("access_token");
      
      if (!externalToken) {
        console.log("🔵 External token not found, obtaining...");
        
        try {
          await axios.post("/api/t1-token", {}, {
            withCredentials: true,
          });
          
          console.log("✅ External token obtained and cookie set");
          // Clear any previous errors
          if (typeof window !== "undefined") {
            localStorage.removeItem("t1_token_error");
          }
        } catch (error: any) {
          console.error("❌ Failed to get external token:", error);
        
          // Save error state to prevent infinite loops
          if (error.response?.status === 404) {
            setAuthError("User not found in Ambassador DAO");
            if (typeof window !== "undefined") {
              localStorage.setItem("t1_token_error", "user_not_found");
            }
            toast.error("Please complete Ambassador DAO onboarding");
          } else {
            setAuthError("Failed to authenticate with Ambassador DAO");
            if (typeof window !== "undefined") {
              localStorage.setItem("t1_token_error", "server_error");
            }
            toast.error("Authentication error. Please try again.");
          }
        }
      } else {
        console.log("✅ External token cookie already exists");
        // Clear any previous errors when token exists
        if (typeof window !== "undefined") {
          localStorage.removeItem("t1_token_error");
        }
      }
    };

    fetchExternalToken();
  }, [status, session?.user?.email]);

  // useEffect #2: Handle new user redirect (original logic)
  useEffect(() => {
    if (
      status === "authenticated" &&
      session.user.is_new_user &&
      (pathname !== "/profile" && pathname !== "/ambassador-dao/onboard")
    ) {
      // Store the original URL with search params (including UTM) in localStorage
      const originalUrl = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      if (typeof window !== "undefined") {
        localStorage.setItem("redirectAfterProfile", originalUrl);
      }
      router.replace("/ambassador-dao/onboard");
    }
  }, [session, status, pathname, router, searchParams]);

  return null;
}
