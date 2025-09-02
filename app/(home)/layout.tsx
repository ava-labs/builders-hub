"use client";

import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { Footer } from "@/components/navigation/footer";
import { baseOptions } from "@/app/layout.config";
import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";

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

function RedirectIfNewUser() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showModal, setShowModal] = useState(false);

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
      
      // Show confirmation modal and redirect immediately
      setShowModal(true);
      router.replace("/profile");
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
          title="Complete your profile"
          description="Please fill your profile information to continue. This will help us provide you with a better experience."
          footer={
            <div className="flex gap-3 w-full">
              <Button
                onClick={handleContinue}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          }
        />
      )}
    </>
  );
}
