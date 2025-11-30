"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

// --- Interfaces ---

export interface BreadcrumbItem {
  label: string;
  href: string;
  isCurrentPage?: boolean;
}

interface RouteMetadata {
  [key: string]: string[];
}

// --- Internal Helper Function ---

/**
 * Converts a URL path segment (e.g., 'user-management') into a readable label (e.g., 'User Management').
 */
function slugToLabel(slug: string): string {
  if (!slug) return '';
  return slug
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Generates breadcrumbs from pathname segments, constructing the correct href for each intermediate step.
 * This function also serves as the robust fallback mechanism.
 * @param pathname The current full URL pathname.
 * @param labels Optional array of human-readable labels to use instead of generating them from slugs.
 * @returns Array of breadcrumb items with accurate hrefs for all segments.
 */
function generateSegmentedBreadcrumbs(pathname: string, labels?: string[]): BreadcrumbItem[] {
    // Start with a clean list of path segments (excluding empty strings from leading/trailing slashes)
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    
    let currentPath = '';

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLast = i === segments.length - 1;
        
        // 1. Determine the label (use custom label if provided, otherwise generate from slug)
        const label = labels && labels[i] ? labels[i] : slugToLabel(segment);

        // 2. Construct the href: each item links to the accumulated path up to that segment.
        currentPath += `/${segment}`;
        
        // Ensure the root path is linked correctly (e.g., the first segment 'console' should link to '/console')
        const href = currentPath; 
        
        // 3. Add the breadcrumb item
        breadcrumbs.push({
            label,
            href,
            isCurrentPage: isLast,
        });
    }

    // Always ensure the root of the console is represented if the path starts with it
    if (segments[0] !== 'console' && pathname.startsWith('/console')) {
        // If the route starts with /console but the segments don't capture the root (e.g., path is just "/console")
        if (pathname === '/console' && segments.length === 0) {
            return [{ label: "Console", href: "/console", isCurrentPage: true }];
        }
    }
    
    // Fallback for an empty path (e.g., '/') should be handled by the router outside this hook, 
    // but we return the generated list.
    return breadcrumbs;
}


// --- Main Hook ---

/**
 * Custom hook to generate breadcrumbs based on the current pathname.
 * It prioritizes clean labels from routeMetadata and falls back to URL segment generation.
 * * @param routeMetadata - Object mapping paths to breadcrumb label arrays.
 * @returns Array of breadcrumb items with labels and segment-aware hrefs.
 */
export function useBreadcrumbs(routeMetadata: RouteMetadata): BreadcrumbItem[] {
  const pathname = usePathname();

  // Memoize the breadcrumb generation based on path and metadata structure.
  return useMemo(() => {
    // 1. Check if metadata provides custom labels for the current path.
    const breadcrumbLabels = routeMetadata[pathname];
    
    if (breadcrumbLabels && breadcrumbLabels.length > 0) {
        // Use custom labels but generate segment-aware links (OPTIMIZATION)
        return generateSegmentedBreadcrumbs(pathname, breadcrumbLabels);
    }

    // 2. Fallback: generate breadcrumbs entirely from pathname segments (ROBUST LOGIC)
    return generateSegmentedBreadcrumbs(pathname);

  }, [pathname, routeMetadata]);
}
