"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

export interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrentPage?: boolean;
}

interface RouteMetadata {
  [key: string]: string[];
}

/**
 * Custom hook to generate breadcrumbs based on the current pathname
 * @param routeMetadata - Object mapping paths to breadcrumb arrays
 * @returns Array of breadcrumb items with labels and hrefs
 */
export function useBreadcrumbs(routeMetadata: RouteMetadata): BreadcrumbItem[] {
  const pathname = usePathname();

  return useMemo(() => {
    // Get the breadcrumb array for the current path
    const breadcrumbLabels = routeMetadata[pathname];
    
    if (!breadcrumbLabels || breadcrumbLabels.length === 0) {
      // Fallback: generate breadcrumbs from pathname segments
      return generateFallbackBreadcrumbs(pathname);
    }

    // Generate breadcrumb items - only the first (Console) and last (current page) are clickable
    const breadcrumbs: BreadcrumbItem[] = [];
    
    for (let i = 0; i < breadcrumbLabels.length; i++) {
      const label = breadcrumbLabels[i];
      const isFirst = i === 0;
      const isLast = i === breadcrumbLabels.length - 1;
      
      let href: string;
      if (isFirst) {
        // First item always links to console root
        href = "/console";
      } else if (isLast) {
        // Last item links to current page
        href = pathname;
      } else {
        // Middle items are not clickable (no intermediate pages exist)
        href = "#";
      }

      breadcrumbs.push({
        label,
        href,
        isCurrentPage: isLast,
      });
    }

    return breadcrumbs;
  }, [pathname, routeMetadata]);
}

/**
 * Generate fallback breadcrumbs from pathname when no metadata exists
 * Only generates Console > Current Page (no intermediate levels)
 */
function generateFallbackBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  
  if (segments.length === 0 || segments[0] !== "console") {
    return [{ label: "Console", href: "/console", isCurrentPage: pathname === "/console" }];
  }

  // For fallback, just show Console > Current Page
  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Console", href: "/console", isCurrentPage: false }
  ];

  if (pathname !== "/console") {
    // Convert the last segment to a readable label for the current page
    const currentPageSegment = segments[segments.length - 1];
    const currentPageLabel = currentPageSegment
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    breadcrumbs.push({
      label: currentPageLabel,
      href: pathname,
      isCurrentPage: true,
    });
  }

  return breadcrumbs;
}
