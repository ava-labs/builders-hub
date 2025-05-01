import type { Metadata } from 'next';
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
  DocsCategory,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
import {
  type ComponentProps,
  type FC,
  type ReactElement,
} from 'react';
import defaultComponents from 'fumadocs-ui/mdx';
import { Popup, PopupContent, PopupTrigger } from 'fumadocs-twoslash/ui';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Callout } from 'fumadocs-ui/components/callout';
import { TypeTable } from 'fumadocs-ui/components/type-table';
import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';
import { createMetadata } from '@/utils/metadata';
import { documentation } from '@/lib/source';
import { AutoTypeTable } from '@/components/content-design/type-table';
import { BackToTop } from '@/components/ui/back-to-top';
import { File, Folder, Files } from 'fumadocs-ui/components/files';
import Mermaid from "@/components/content-design/mermaid";
import type { MDXComponents } from 'mdx/types';
import YouTube from '@/components/content-design/youtube';
import { Feedback } from '@/components/ui/feedback';
import posthog from 'posthog-js';

export const dynamicParams = false;
export const revalidate = false;

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<ReactElement> {
  const params = await props.params;
  const page = documentation.getPage(params.slug);
  if (!page) notFound();

  const { body: MDX, toc } = await page.data.load();
  const path = `content/docs/${page.file.path}`;

  return (
    <DocsPage
      toc={toc}
      full={page.data.full}
      tableOfContent={{
        style: 'clerk',
        single: false,
        footer: (
          <BackToTop />
        ),
      }}
      article={{
        className: 'max-sm:pb-16',
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody className="text-fd-foreground/80">
        <MDX
          components={{
            ...defaultComponents,
            ...((await import('lucide-react')) as unknown as MDXComponents),

            Popup,
            PopupContent,
            PopupTrigger,
            Tabs,
            Tab,
            Step,
            Steps,
            YouTube,
            Mermaid,
            TypeTable,
            AutoTypeTable,
            Accordion,
            Accordions,
            File,
            Folder,
            Files,
            blockquote: Callout as unknown as FC<ComponentProps<'blockquote'>>,
            DocsCategory: () => <DocsCategory page={page} from={documentation} />,
          }}
        />
        {page.data.index ? <DocsCategory page={page} from={documentation} /> : null}
      </DocsBody>
      <Feedback
        path={path}
        title={page.data.title}
        pagePath={`/docs/${page.slugs.join('/')}`}
        onRateAction={async (url, feedback) => {
          'use server';
          await posthog.capture('on_rate_document', feedback);
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
    page.data.description ?? 'Developer documentation for everything related to the Avalanche ecosystem.';

  const imageParams = new URLSearchParams();
  imageParams.set('title', page.data.title);
  imageParams.set('description', description);

  const image = {
    alt: 'Banner',
    url: `/api/og/docs/${params.slug[0]}?${imageParams.toString()}`,
    width: 1200,
    height: 630,
  };

  return createMetadata({
    title: page.data.title,
    description,
    openGraph: {
      url: `/docs/${page.slugs.join('/')}`,
      images: image,
    },
    twitter: {
      images: image,
    },
  });
}
