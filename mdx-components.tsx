import type { MDXComponents } from "mdx/types";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Callout } from "fumadocs-ui/components/callout";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { Cards, Card } from "fumadocs-ui/components/card";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { Heading } from "fumadocs-ui/components/heading";
import defaultComponents from "fumadocs-ui/mdx";
import {
  CodeBlock,
  type CodeBlockProps,
  Pre,
} from "fumadocs-ui/components/codeblock";
import type { ReactNode } from "react";
import "fumadocs-twoslash/twoslash.css";
import { Popup, PopupContent, PopupTrigger } from "fumadocs-twoslash/ui";
import YouTube from "@/components/content-design/youtube";
import Gallery from "@/components/content-design/gallery";
import { cn } from "@/utils/cn";
import { BadgeCheck } from "lucide-react";
import dynamic from "next/dynamic";
import { DataAPIPage, MetricsAPIPage } from "@/components/api/api-pages";
import Quiz from "@/components/quizzes/quiz";

const Mermaid = dynamic(() => import("@/components/content-design/mermaid"), {
  ssr: false,
});

const StateGrowthChart = dynamic(() => import("@/components/content-design/state-growth-chart"), {
  ssr: false,
});

export function useMDXComponents(components: MDXComponents): MDXComponents {
  // Exclude heading and img components from defaultComponents to avoid conflicts
  const { h1, h2, h3, h4, h5, h6, img, ...restDefaultComponents } = defaultComponents;

  // Custom components registered as MDX shortcodes. The MDXComponents index
  // signature in @mdx-js/mdx v3 is stricter than before, so we type these
  // separately and merge with a cast.
  const customComponents = {
    BadgeCheck,
    Popup,
    PopupContent,
    PopupTrigger,
    Tabs,
    Tab,
    Cards,
    Card,
    Callout,
    TypeTable,
    Step,
    Steps,
    APIPage: (props: any) => {
      const document = props.document || '';
      const isMetricsApi = document.includes('popsicle.json');
      return isMetricsApi ? <MetricsAPIPage {...props} /> : <DataAPIPage {...props} />;
    },
    Accordion,
    Accordions,
    YouTube,
    Gallery,
    Mermaid,
    StateGrowthChart,
    Quiz,
    InstallTabs: ({
      items,
      children,
    }: {
      items: string[];
      children: ReactNode;
    }) => (
      <Tabs items={items} id="package-manager">
        {children}
      </Tabs>
    ),
  };

  // The MDXComponents index signature in @mdx-js/mdx v3 (via next-mdx-remote 6)
  // is stricter and doesn't accept arbitrary React components for custom keys.
  // We build the full map untyped and cast at the boundary.
  const allComponents: Record<string, any> = {
    ...restDefaultComponents,
    h1: (props: any) => <Heading as="h1" {...props} />,
    h2: (props: any) => <Heading as="h2" {...props} />,
    h3: (props: any) => <Heading as="h3" {...props} />,
    h4: (props: any) => <Heading as="h4" {...props} />,
    h5: (props: any) => <Heading as="h5" {...props} />,
    h6: (props: any) => <Heading as="h6" {...props} />,
    // Fix srcset -> srcSet for React 19 compatibility
    img: (props: any) => {
      const { srcset, ...imgProps } = props;
      // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
      return <img {...imgProps} {...(srcset && { srcSet: srcset })} />;
    },
    pre: ({ title, className, icon, allowCopy, ...props }: CodeBlockProps) => (
      <CodeBlock title={title} icon={icon} allowCopy={allowCopy}>
        <Pre className={cn("max-h-[1200px]", className)} {...(props as any)} />
      </CodeBlock>
    ),
    blockquote: (props: any) => <Callout>{props.children}</Callout>,
    ...customComponents,
    ...components,
  };

  return allComponents as MDXComponents;
}
