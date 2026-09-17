import type { Metadata } from "next";
import { createMetadata } from "@/utils/metadata";
import { pathToBreadcrumb } from "./breadcrumbs-mapping";

/**
 * Social metadata for a console tool page: the console og card with the
 * tool's name (from the breadcrumbs mapping, the single source of tool
 * naming) as the card title, plus the page's canonical url.
 */
export function consoleToolMetadata(path: string, titleOverride?: string): Metadata {
  const crumbs = pathToBreadcrumb[path as keyof typeof pathToBreadcrumb] as string[] | undefined;
  const title = titleOverride ?? crumbs?.[crumbs.length - 1] ?? "Console";
  const image = {
    url: `/api/og/console?title=${encodeURIComponent(title)}`,
    width: 1200,
    height: 630,
    alt: `${title} · Avalanche Builder Console`,
  };
  return createMetadata({
    title,
    description: `${title} in the Avalanche Builder Console: launch and operate Avalanche L1s.`,
    openGraph: { url: path, images: image },
    twitter: { images: image },
  });
}
