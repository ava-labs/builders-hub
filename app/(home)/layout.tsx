"use client";

import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { ReactNode } from "react";
import { Footer } from "@/components/navigation/footer";
import { baseOptions } from "@/app/layout.config";
import { SessionProvider } from "next-auth/react";

export default function Layout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <>
      <div>
        <SessionProvider>
          <HomeLayout {...baseOptions}>
            {children}
            <Footer />
          </HomeLayout>
        </SessionProvider>
      </div>
    </>
  );
}
