import type { Metadata } from 'next';
import { createMetadata } from './metadata';

/**
 * Metadata for explorer pages whose social card is the chain card
 * (app/api/og/stats/[slug]): the page's title and description rendered over
 * the shared template, with the page's own canonical url.
 */
export function chainCardMetadata({
  chainSlug,
  title,
  description,
  url,
}: {
  chainSlug: string;
  title: string;
  description: string;
  url: string;
}): Metadata {
  const imageParams = new URLSearchParams();
  // The card renders cleaner without the site-section suffix; the <title>
  // keeps it.
  imageParams.set('title', title.replace(/\s*\|\s*Avalanche Explorer$/, ''));
  imageParams.set('description', description);
  const image = {
    url: `/api/og/stats/${chainSlug}?${imageParams.toString()}&v=2`,
    width: 1200,
    height: 630,
    alt: title,
  };
  return createMetadata({
    title,
    description,
    openGraph: { title, description, url, images: image },
    twitter: { images: image },
  });
}
