"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/**
 * A Link that prefetches once the visitor shows intent (hover, focus or
 * touch), not when it scrolls into view. A viewport prefetch of a static
 * route applies that route's CSS and image preloads to the current page, and
 * Chrome reports each one as preloaded but not used. This is the
 * hover-triggered prefetch from Next's prefetching guide.
 */
export function HoverPrefetchLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: Omit<ComponentProps<typeof Link>, "prefetch">) {
  const [active, setActive] = useState(false);
  return (
    <Link
      {...props}
      prefetch={active ? null : false}
      onMouseEnter={(event) => {
        setActive(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setActive(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setActive(true);
        onTouchStart?.(event);
      }}
    />
  );
}
