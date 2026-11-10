"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Next's router, kept in a ref by a child that renders nothing: useRouter
   reads the layout's context, which changes with every change of the URL,
   so a large view that called it would render again for each one. The
   city, the 3D city and the flow chart hold their router this way. */
export type Router = ReturnType<typeof useRouter>;

export function RouterRef({ into }: { into: { current: Router | null } }) {
  const router = useRouter();
  useEffect(() => {
    into.current = router;
  }, [into, router]);
  return null;
}
