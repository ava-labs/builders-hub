import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getGuidePage, getGuidePages } from '@/utils/content-loader/guide-loader';
import { createMetadata } from '@/utils/metadata';
import { buttonVariants } from '@/components/ui/button';
import { ArrowUpRightIcon, MessagesSquare, AlertCircle } from 'lucide-react';
import { SiX } from '@icons-pack/react-simple-icons';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Popup, PopupContent, PopupTrigger } from 'fumadocs-twoslash/ui';
import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Callout } from "fumadocs-ui/components/callout";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import { AutoTypeTable } from '@/components/content-design/type-table';
import { Heading } from 'fumadocs-ui/components/heading';
import YouTube from "@/components/content-design/youtube";
import Gallery from "@/components/content-design/gallery";
import { cn } from "@/utils/cn";
import {
  CodeBlock,
  type CodeBlockProps,
  Pre,
} from "fumadocs-ui/components/codeblock";
import { BadgeCheck } from "lucide-react";
import Mermaid from "@/components/content-design/mermaid";
import Comments from '@/components/ui/comments';
import newGithubIssueUrl from 'new-github-issue-url';

export const dynamicParams = false;

export default async function Page(props: {
  params: Promise<{ slug: string }>;
}) {
    const params = await props.params;
    const page = getGuidePage([params.slug]);
    if (!page) notFound();

    const { body: MDX } = await page.data.load();
    const path = `content/guides/${page.file.path}`;

    return (
        <>
            <div
                className="container rounded-xl border mt-5 py-12 md:px-8"
                style={{
                    backgroundColor: 'black',
                    backgroundImage: [
                        'linear-gradient(140deg, #3752AC 0%, transparent 50%)',
                        'linear-gradient(to left top, #E84142 0%, transparent 50%)',
                        'radial-gradient(circle at 100% 100%, #3752AC, #E84142 17%, transparent 20%)',
                    ].join(', '),
                    backgroundBlendMode: 'difference, difference, normal',
                }}
            >
                <h1 className="mb-2 text-3xl font-bold text-white">
                    {page.data.title}
                </h1>
                <p className="mb-4 text-white/80">{page.data.description}</p>
                <Link
                    href="/guides"
                    className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                >
                    Back
                </Link>
            </div>
            <article className="container grid grid-cols-1 px-0 py-8 lg:grid-cols-[2fr_1fr] lg:px-4">
                <div className="prose p-4">
                <MDX components={{
                h1: (props) => <Heading as="h1" {...props} />,
                h2: (props) => <Heading as="h2" {...props} />,
                h3: (props) => <Heading as="h3" {...props} />,
                h4: (props) => <Heading as="h4" {...props} />,
                h5: (props) => <Heading as="h5" {...props} />,
                h6: (props) => <Heading as="h6" {...props} />,
                BadgeCheck, Cards, Card, Callout, Accordion, Accordions, AutoTypeTable, Gallery, Mermaid, Popup, PopupContent, PopupTrigger, Step, Steps, Tab, Tabs, TypeTable, YouTube, 
                pre: ({ title, className, icon, allowCopy, ...props }: CodeBlockProps) => (
                    <CodeBlock title={title} icon={icon} allowCopy={allowCopy}>
                    <Pre className={cn("max-h-[1200px]", className)} {...props} />
                    </CodeBlock>
                ),
                }}/>
                    {page.data.comments && (
                        <Callout title="" icon={<MessagesSquare stroke="#3752ac"/>}><Comments/></Callout>
                    )}
                </div>
                <div className="flex flex-col gap-4 border-l p-4 text-sm">
                    <div>
                        <p className="mb-1 text-muted-foreground">Written by</p>
                        <div className="col-span-2 flex flex-col gap-2">
                            {page.data.authors.map((author: string) => (
                                <Link
                                    key={author}
                                    href={`https://x.com/${author}`}
                                    target='_blank'
                                    className="text-foreground transition-colors flex flex-row items-center gap-2 group"
                                >
                                    <SiX size={12} />
                                    <span className="flex-grow truncate">{author}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="mb-1 text-sm text-muted-foreground">On</p>
                        <p className="font-medium">
                            {new Date(page.data.date ?? page.file.name).toDateString()}
                        </p>
                    </div>

                    <div>
                        <p className="mb-2 text-muted-foreground">Topics</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                            {page.data.topics.map((item: string) => (
                                <span key={item}
                                    className="relative z-10 rounded-full bg-fd-accent px-3 py-1.5 font-medium text-muted-foreground"
                                >
                                    {item}
                                </span>
                            ))}
                        </div>
                    </div>

                    <a
                        href={`https://github.com/ava-labs/avalanche-docs/blob/master/${path}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <ArrowUpRightIcon className="size-5" /> Edit on Github
                    </a>
                    <a
                        href={newGithubIssueUrl({
                            user: 'ava-labs',
                            repo: 'avalanche-docs',
                            title: `Update Guide ${page.data.title} information`,
                            body: `It appears that the information on this page might be outdated. Please review and update as needed.\n\nPage: /guides/${params.slug}\n\n[Provide more details here...]`,
                            labels: ['outdated', 'documentation'],
                        })}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                    >
                        <AlertCircle className="size-5" /> Report Issue
                    </a>
                </div>
            </article>
        </>
    );
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = getGuidePage([params.slug]);

  if (!page) notFound();

  const description =
    page.data.description ?? 'Learn how to build on Avalanche blockchain with Academy';

  const imageParams = new URLSearchParams();
  imageParams.set('title', page.data.title);
  imageParams.set('description', description);

  const image = {
    alt: 'Banner',
    url: `/api/og/guides/${params.slug[0]}?${imageParams.toString()}`,
    width: 1200,
    height: 630,
  };

  return createMetadata({
    title: page.data.title,
    description,
    openGraph: {
      url: `/guides/${page.slugs.join('/')}`,
      images: image,
    },
    twitter: {
      images: image,
    },
  });
}


export function generateStaticParams(): { slug: string }[] {
    return getGuidePages().map((page) => ({
        slug: page.slugs[0],
    }));
}