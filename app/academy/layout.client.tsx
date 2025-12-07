"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function AcademyLayoutClient() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/academy")) {
      document.body.setAttribute("data-layout", "academy");
    } else {
      document.body.removeAttribute("data-layout");
    }

    return () => {
      document.body.removeAttribute("data-layout");
    };
  }, [pathname]);

  return null;
}
