import Mermaid from "@/components/content-design/mermaid";
import { AutoTypeTable } from "@/components/content-design/type-table";
import YouTube from "@/components/content-design/youtube";
import { BackToTop } from "@/components/ui/back-to-top";
import { Feedback } from "@/components/ui/feedback";
import { SidebarActions } from "@/components/ui/sidebar-actions";
import { CChainAPIPage, DataAPIPage, MetricsAPIPage, PChainAPIPage, XChainAPIPage } from "@/components/api/api-pages";
import AddNetworkButtonInline from "@/components/client/AddNetworkButtonInline";
import { documentation } from "@/lib/source";
import { createMetadata } from "@/utils/metadata";
import { Popup, PopupContent, PopupTrigger } from "fumadocs-twoslash/ui";
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Heading } from "fumadocs-ui/components/heading";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultComponents from "fumadocs-ui/mdx";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import type { MDXComponents } from "mdx/types";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import posthog from "posthog-js";
import { type ComponentProps, type FC, type ReactElement, type ReactNode } from "react";

export const dynamicParams = true;
export const revalidate = false;

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<ReactElement> {
  const params = await props.params;
  const page = documentation.getPage(params.slug);

  if (!page) notFound();

  const { body: MDX, toc } = await page.data.load();
  const path = `content/docs${page.url.replace('/docs/', '/')}.mdx`;

  // Use custom edit URL if provided in frontmatter, otherwise use default path
  const editUrl =
    (page.data.edit_url as string) ||
    `https://github.com/ava-labs/builders-hub/edit/master/${path}`;

  return (
    <DocsPage
      toc={toc}
      full={page.data.full}
      tableOfContent={{
        style: "clerk",
        single: false,
        footer: (
          <>
        <SidebarActions
          editUrl={editUrl}
          title={(page.data.title as string) || "Untitled"}
          pagePath={`/${params.slug.join("/")}`}
          pageType="docs"
        />
            <BackToTop />
          </>
        ),
      }}
      article={{
        className: "max-sm:pb-16",
      }}
    >
      <DocsTitle>{page.data.title || "Untitled"}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody className="text-fd-foreground/80">
        <MDX
          components={{
            ...(() => {
              const { h1, h2, h3, h4, h5, h6, img, ...restComponents } = defaultComponents;
              return restComponents;
            })(),
            ...((await import("lucide-react")) as unknown as MDXComponents),

            h1: (props) => <Heading as="h1" {...props} />,
            h2: (props) => <Heading as="h2" {...props} />,
            h3: (props) => <Heading as="h3" {...props} />,
            h4: (props) => <Heading as="h4" {...props} />,
            h5: (props) => <Heading as="h5" {...props} />,
            h6: (props) => <Heading as="h6" {...props} />,
            // Fix srcset -> srcSet for React 19 compatibility
            img: (props: any) => {
              const { srcset, ...imgProps } = props;
              // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
              return <img {...imgProps} {...(srcset && { srcSet: srcset })} />;
            },
            Popup,
            PopupContent,
            PopupTrigger,
            Tabs,
            Tab,
            InstallTabs: ({
              items,
              children,
            }: {
              items: string[];
              children: ReactNode;
            }) => (
              <Tabs items={items} style={{ padding: '15px'}} id="package-manager">
                {children}
              </Tabs>
            ),
            Step,
            Steps,
            YouTube,
            Mermaid,
            AddNetworkButtonInline,
            TypeTable,
            AutoTypeTable,
            Accordion,
            Accordions,
            File,
            Folder,
            Files,
            APIPage: (props: any) => {
              // Determine which API instance to use based on document path
              const document = props.document || '';
              const isMetricsApi = document.includes('popsicle.json');
              const isPChainApi = document.includes('platformvm.yaml');
              const isCChainApi = document.includes('coreth.yaml');
              const isXChainApi = document.includes('xchain.yaml');
              
              if (isPChainApi) {
                return <PChainAPIPage {...props} />;
              } else if (isCChainApi) {
                return <CChainAPIPage {...props} />;
              } else if (isXChainApi) {
                return <XChainAPIPage {...props} />;
              } else if (isMetricsApi) {
                return <MetricsAPIPage {...props} />;
              } else {
                return <DataAPIPage {...props} />;
              }
            },
            blockquote: Callout as unknown as FC<ComponentProps<"blockquote">>,
          }}
        />
      </DocsBody>
      <Feedback
        path={path}
        title={page.data.title || "Untitled"}
        pagePath={`/docs/${page.slugs.join("/")}`}
        onRateAction={async (url, feedback) => {
          "use server";
          await posthog.capture("on_rate_document", feedback);
        }}
      />
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return documentation.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = documentation.getPage(params.slug);

  if (!page) notFound();

  const description =
    page.data.description ??
    "Developer documentation for everything related to the Avalanche ecosystem.";

  const imageParams = new URLSearchParams();
  imageParams.set("title", page.data.title || "Untitled");
  imageParams.set("description", description);

  const image = {
    alt: "Banner",
    url: `/api/og/docs/${params.slug[0]}?${imageParams.toString()}`,
    width: 1200,
    height: 630,
  };

  return createMetadata({
    title: page.data.title || "Untitled",
    description,
    openGraph: {
      url: `/docs/${page.slugs.join("/")}`,
      images: image,
    },
    twitter: {
      images: image,
    },
  });
}
