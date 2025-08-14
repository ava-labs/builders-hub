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

    // Generate breadcrumb items with proper hrefs
    const breadcrumbs: BreadcrumbItem[] = [];
    
    for (let i = 0; i < breadcrumbLabels.length; i++) {
      const label = breadcrumbLabels[i];
      const isLast = i === breadcrumbLabels.length - 1;
      
      let href: string;
      if (i === 0) {
        // First item is always console root
        href = "/console";
      } else {
        // Build href by finding the path segments up to this point
        href = buildHrefFromSegments(pathname, i, breadcrumbLabels.length);
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
 */
function generateFallbackBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  
  if (segments.length === 0 || segments[0] !== "console") {
    return [{ label: "Console", href: "/console", isCurrentPage: pathname === "/console" }];
  }

  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = "";

  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const isLast = index === segments.length - 1;
    
    // Convert segment to readable label
    const label = segment
      .split("-")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    breadcrumbs.push({
      label,
      href: currentPath,
      isCurrentPage: isLast,
    });
  });

  return breadcrumbs;
}

/**
 * Build href for a breadcrumb item based on its position in the breadcrumb chain
 */
function buildHrefFromSegments(fullPath: string, currentIndex: number, totalBreadcrumbs: number): string {
  const pathSegments = fullPath.split("/").filter(Boolean);
  
  if (currentIndex === 0) {
    return "/console";
  }
  
  // Calculate how many path segments this breadcrumb represents
  const segmentsForThisBreadcrumb = Math.ceil((pathSegments.length * currentIndex) / (totalBreadcrumbs - 1));
  
  return "/" + pathSegments.slice(0, segmentsForThisBreadcrumb).join("/");
}
