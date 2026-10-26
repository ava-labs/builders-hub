import { TransactionLifecycle } from "@/components/sae/TransactionLifecycle";
import { FirewoodPage } from "@/components/firewood/FirewoodPage";
import { ValidatorFlowExplainer } from "@/components/validator-flow/ValidatorFlowExplainer";
import { StaircaseFigure } from "@/components/epoched-view/StaircaseFigure";
import { HeightsRuler } from "@/components/epoched-view/HeightsRuler";
import StateGrowthChart from "@/components/content-design/state-growth-chart";
import { BackToTop } from "@/components/ui/back-to-top";
import { Feedback } from "@/components/ui/feedback";
import { SidebarActions } from "@/components/ui/sidebar-actions";
import { ZoomableImage } from "@/components/ui/zoomable-image";
import { CChainAPIPage, DataAPIPage, MetricsAPIPage, PChainAPIPage, VerificationAPIPage, XChainAPIPage } from "@/components/api/api-pages";
import AddNetworkButtonInline from "@/components/client/AddNetworkButtonInline";
import { documentation } from "@/lib/source";
import { createMetadata } from "@/utils/metadata";
import { sharedMDXComponents } from "@/components/mdx/shared-components";
import { DocsCallout } from "@/components/docs-book/callout";
import { DocsCodeBlock } from "@/components/docs-book/code-block";
import { ColorKeyToggle } from "@/components/docs-book/color-key-toggle";
import { Figure } from "@/components/docs-book/figure";
import { RewardRoutesFigure } from "@/components/docs-book/reward-routes-figure";
import { docsFigures } from "@/components/docs-book/figures";
import { Term } from "@/components/docs-book/term";
import { File, Files, Folder } from "fumadocs-ui/components/files";
import { Tabs } from "fumadocs-ui/components/tabs";
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
import { type ComponentProps, type FC, type ReactElement, type ReactNode, ViewTransition } from "react";

export const dynamicParams = true;
export const revalidate = false;

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<ReactElement> {
  const params = await props.params;
  const page = documentation.getPage(params.slug);

  if (!page) notFound();

  const { body: MDX, toc } = await page.data.load();
  // Use page.path which contains the actual file path relative to collection root
  // (e.g., "tooling/avalanche-sdk/index.mdx" for an index file)
  // This correctly handles both regular .mdx files and index.mdx files
  const path = `content/docs/${page.path}`;

  // Use custom edit URL if provided in frontmatter, otherwise use default path
  const editUrl =
    (page.data.edit_url as string) ||
    `https://github.com/ava-labs/builders-hub/edit/master/${path}`;

  // site-page-transition: going to another docs page, this page fades out and the next one fades in (app/global.css,
  // bk-page-out and bk-page-in). React names the root of DocsPage, #nd-page (the article and its TOC), only for the
  // change, so the navbar and the sidebar stay in the held root. default="none": an update in place, such as a
  // same-page hash link, never fades.
  return (
    <ViewTransition enter="bk-page-in" exit="bk-page-out" default="none">
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
              <ColorKeyToggle />
              <BackToTop />
            </>
          ),
        }}
        // Below 1280px the TOC rail is hidden, so the popover carries the color key too. Only with headings:
        // a footer alone makes fumadocs show the popover bar on a page with no headings.
        tableOfContentPopover={toc.length > 0 ? { footer: <ColorKeyToggle /> } : undefined}
      >
        <DocsTitle>{page.data.title || "Untitled"}</DocsTitle>
        {page.data.description && (
          <DocsDescription>{page.data.description}</DocsDescription>
        )}
        <DocsBody className="text-fd-foreground/80">
          <MDX
            components={{
              ...(() => {
                const { h1, h2, h3, h4, h5, h6, img, ...restComponents } = defaultComponents;
                return restComponents;
              })(),
              ...((await import("lucide-react")) as unknown as MDXComponents),
              ...sharedMDXComponents,
              Callout: DocsCallout,
              Figure,
              Term,
              RewardRoutesFigure,
              ...docsFigures,
              // docs-code-copy: the copy button morphs its clipboard into a check (components/docs-book/code-block.tsx).
              pre: DocsCodeBlock,
              // X3: a docs image opens full size from where it sits, like a blog chart (eco-blog-image-zoom). The
              // zoomable image also passes srcset on as srcSet for React 19.
              img: ZoomableImage,
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
              StateGrowthChart,
              TransactionLifecycle,
              FirewoodPage,
              ValidatorFlowExplainer,
              StaircaseFigure,
              HeightsRuler,
              AddNetworkButtonInline,
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
                const isVerificationApi = document.includes('verification.json');

                if (isPChainApi) {
                  return <PChainAPIPage {...props} />;
                } else if (isCChainApi) {
                  return <CChainAPIPage {...props} />;
                } else if (isXChainApi) {
                  return <XChainAPIPage {...props} />;
                } else if (isMetricsApi) {
                  return <MetricsAPIPage {...props} />;
                } else if (isVerificationApi) {
                  return <VerificationAPIPage {...props} />;
                } else {
                  return <DataAPIPage {...props} />;
                }
              },
              blockquote: (props: ComponentProps<"blockquote">) => (
                <DocsCallout art={false}>{props.children}</DocsCallout>
              ),
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
    </ViewTransition>
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
    url: `/api/og/docs/${params.slug[0]}?${imageParams.toString()}&v=2`,
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
