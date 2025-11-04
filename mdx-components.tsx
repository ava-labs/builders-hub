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
import { APIPage } from 'fumadocs-openapi/ui';
import { dataApi, metricsApi } from "./lib/openapi";
import { APIStorageManager } from "@/components/content-design/api-storage-manager";

const Mermaid = dynamic(() => import("@/components/content-design/mermaid"), {
  ssr: false,
});

export function useMDXComponents(components: MDXComponents): MDXComponents {
  // Exclude heading and img components from defaultComponents to avoid conflicts
  const { h1, h2, h3, h4, h5, h6, img, ...restDefaultComponents } = defaultComponents;
  
  return {
    ...restDefaultComponents,
    h1: (props) => <Heading as="h1" {...props} />,
    h2: (props) => <Heading as="h2" {...props} />,
    h3: (props) => <Heading as="h3" {...props} />,
    h4: (props) => <Heading as="h4" {...props} />,
    h5: (props) => <Heading as="h5" {...props} />,
    h6: (props) => <Heading as="h6" {...props} />,
    BadgeCheck,
    Popup,
    PopupContent,
    PopupTrigger,
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
    Tabs,
    Tab,
    Cards,
    Card,
    Callout,
    TypeTable,
    Step,
    Steps,
    APIPage: (props: any) => {
      // Determine which API instance to use based on the document path
      const document = props.document || '';
      const isMetricsApi = document.includes('popsicle.json');
      const apiInstance = isMetricsApi ? metricsApi : dataApi;
      const storageKey = isMetricsApi ? 'apiBaseUrl-metrics' : 'apiBaseUrl-data';
      
      return (
        <>
          <APIStorageManager storageKey={storageKey} />
          <APIPage {...apiInstance.getAPIPageProps(props)} />
        </>
      );
    },
    Accordion,
    Accordions,
    YouTube,
    Gallery,
    Mermaid,
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
    blockquote: (props) => <Callout>{props.children}</Callout>,
    ...components,
  };
}
