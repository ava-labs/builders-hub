"use client";

import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { Footer } from "@/components/navigation/footer";
import { baseOptions } from "@/app/layout.config";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import Modal from "@/components/ui/Modal";
import { Terms } from "@/components/login/terms";

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
  if (typeof document === "undefined") return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || null;
  }

  return null;
}

function RedirectIfNewUser() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);


  useEffect(() => {
    const fetchExternalToken = async () => {
      if (status !== "authenticated" || !session?.user?.email) return;

      // Check if the external token cookie already exists
      const externalToken = getCookie("access_token");

      if (!externalToken) {
 
        try {
          await axios.post(
            "/api/t1-token",
            {},
            {
              withCredentials: true,
            }
          );

          if (typeof window !== "undefined") {
            localStorage.removeItem("t1_token_error");
          }
        } catch (error: any) {
          if (error.response?.status === 404) {
            setAuthError("User not found in Ambassador DAO");
            if (typeof window !== "undefined") {
              localStorage.setItem("t1_token_error", "user_not_found");
            }
          } else {
            setAuthError("Failed to authenticate with Ambassador DAO");
            if (typeof window !== "undefined") {
              localStorage.setItem("t1_token_error", "server_error");
            }
          }
        }
      } else {
        if (typeof window !== "undefined") {
          localStorage.removeItem("t1_token_error");
        }
      }
    };

    fetchExternalToken();
  }, [status, session?.user?.email]);

  useEffect(() => {
    const errorLocalStorage = localStorage.getItem("t1_token_error");
    if (
      status === "authenticated" &&
      session.user.is_new_user &&
      pathname !== "/profile" &&
      pathname !== "/login" &&
      pathname !== "/ambassador-dao/onboard" &&
      errorLocalStorage != ""
    ) {
      const originalUrl = `${pathname}${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      if (typeof window !== "undefined") {
        localStorage.setItem("redirectAfterProfile", originalUrl);
      }
      setShowModal(true);
    }
  }, [session, status, pathname, router, searchParams]);

  const handleContinue = () => {
    setShowModal(false);
  };

  return (
    <>
      {showModal && (
        <Modal
          className="border border-red-500"
          isOpen={showModal}
          onOpenChange={setShowModal}
          title=""
          content={<Terms userId={session?.user?.id ?? ""} onSuccess={handleContinue} onDecline={handleContinue} />}
        />
      )}
    </>
  );
}
