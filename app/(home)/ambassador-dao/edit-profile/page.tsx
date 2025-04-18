"use client";

import React from "react";
import AmbasssadorDaoOnboardPage from "../onboard/page";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function page() {
  const router = useRouter();
  const pathname = usePathname();

  const handleGoBack = () => {
    router.push(pathname);
  };

  return (
    <div className="relative">
      {pathname == "/ambassador-dao/edit-profile" && (
        <div className="max-w-7xl mx-auto mt-12 md:-mb-12 px-4 sm:px-8 md:px-16 lg:px-24">
          <Link
            href="/ambassador-dao/profile"
            className="flex items-center justify-center rounded-md gap-2 py-4 cursor-pointer w-[121px] h-10 border border-[var(--default-border-color)]"
            onClick={handleGoBack}
          >
            <ArrowLeft color="var(--white-text-color)" size={16} />
            Go Back
          </Link>
        </div>
      )}

      <div>
        <AmbasssadorDaoOnboardPage />
      </div>
    </div>
  );
}
