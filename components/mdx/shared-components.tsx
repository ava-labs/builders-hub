/**
 * Shared MDX Components Registry
 *
 * This module provides a unified MDX component configuration used across all page types
 * (docs, blog, and academy). It consolidates previously fragmented component registrations
 * and ensures consistent rendering behavior throughout the application.
 *
 * ## Architecture
 *
 * ### Component Layer
 * - `Mermaid` component (components/content-design/mermaid.tsx): Handles client-side rendering
 *   with SVG injection and theme-change re-renders
 *
 * ### Content Conversion
 * - `convertMermaidBlocks` (utils/remote-content/parsers/pipelines.mts): Transforms Mermaid
 *   code blocks into JSX components during content processing
 *
 * ### MDX Integration
 * - This file provides the single registry used by all page templates:
 *   - app/docs/[...slug]/page.tsx
 *   - app/blog/[...slug]/page.tsx
 *   - app/academy/[...slug]/page.tsx
 *
 * ## Benefits
 * - Single source of truth for common MDX components
 * - Consistent rendering behavior across all content types
 * - Reduced per-page integration requirements
 * - Improved maintainability and predictability
 *
 * @see https://github.com/ava-labs/builders-hub/issues/2724
 */

import Mermaid from "@/components/content-design/mermaid";
import YouTube from "@/components/content-design/youtube";
import Gallery from "@/components/content-design/gallery";
import { AutoTypeTable } from "@/components/content-design/type-table";
import { Heading } from "fumadocs-ui/components/heading";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { Popup, PopupContent, PopupTrigger } from "fumadocs-twoslash/ui";
import type { MDXComponents } from "mdx/types";

/**
 * Shared MDX components used across docs, blog, and academy pages.
 * This provides a single source of truth for common components like Mermaid charts.
 */
export const sharedMDXComponents: MDXComponents = {
  // Headings with consistent styling
  h1: (props) => <Heading as="h1" {...props} />,
  h2: (props) => <Heading as="h2" {...props} />,
  h3: (props) => <Heading as="h3" {...props} />,
  h4: (props) => <Heading as="h4" {...props} />,
  h5: (props) => <Heading as="h5" {...props} />,
  h6: (props) => <Heading as="h6" {...props} />,

  // Content components
  Mermaid,
  YouTube,
  Gallery,
  Callout,

  // Interactive components
  Accordion,
  Accordions,
  Cards,
  Card,
  Step,
  Steps,
  Tab,
  Tabs,

  // Type tables
  TypeTable,
  AutoTypeTable,

  // Twoslash popups
  Popup,
  PopupContent,
  PopupTrigger,
};
