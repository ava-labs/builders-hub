import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { integration } from '@/lib/source';
import { createMetadata } from '@/utils/metadata';
import { buttonVariants } from '@/components/ui/button';
import { Pill, Pills } from '@/components/ui/pills';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import { Feedback } from '@/components/ui/feedback';
import posthog from 'posthog-js';

export default async function Page(props: {
  params: Promise<{ slug: string[] }>;
}) {
    const params = await props.params;
    const page = integration.getPage(params.slug);
    if (!page) notFound();

    // Dynamically build the issue title based on the page title.
    const issueTitle = page.data.title 
        ? `Update Integration ${page.data.title} information`
        : "Update Integration Information";

    const { body: MDX } = await page.data.load();
    const path = `content/integrations/${page.file.path}`;

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
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <img
                            src={page.data.logo}
                            alt={page.data.title}
                            className="w-12 h-12 object-contain mr-4"
                        />
                        <h1 className="mb-2 text-3xl font-bold text-white">
                            {page.data.title}
                        </h1>
                    </div>


                </div>
                <p className="mb-4 text-white/80">{page.data.description}</p>
                <Link
                    href="/integrations"
                    className={buttonVariants({ size: 'sm', variant: 'secondary' })}
                >
                    Back
                </Link>
            </div>
            <article className="container grid grid-cols-1 px-0 py-8 lg:grid-cols-[2fr_1fr] lg:px-4">
                <div className="prose p-4">
                    <MDX components={defaultMdxComponents}/>
                    <Feedback
                        path={path}
                        title={page.data.title}
                        pagePath={`/docs/${page.slugs.join('/')}`}
                        onRateAction={async (url, feedback) => {
                        'use server';
                        await posthog.capture('on_rate_document', feedback);
                        }}
                    />
                </div>
                <div className="flex flex-col gap-4 border-l p-4 text-sm">
                    <div>
                        <p className="mb-1 text-sm text-muted-foreground">Developer:</p>
                        <p className="font-medium">{page.data.developer}</p>
                    </div>
                    <div>
                        <p className="mb-2 text-muted-foreground">Categories:</p>
                        <div className="flex flex-wrap items-center gap-4 text-xs">
                            <Pill item={{ text: page.data.category }} />
                        </div>
                    </div>
                    {
                        page.data.available && page.data.available.length > 0 && <div>
                            <p className="mb-2 text-muted-foreground">Available For:</p>
                            <div className="flex flex-wrap items-center gap-4 text-xs">
                                <Pills items={page.data.available.map((c: string) => { return { text: c } })} />
                            </div>
                        </div>
                    }
                    <div>
                        <p className="mb-1 text-muted-foreground">Website:</p>
                        <a href={page.data.website} target="_blank" rel="noreferrer noopener">
                            {page.data.website}
                        </a>
                    </div>
                    <div>
                        <p className="mb-1 text-muted-foreground">Documentation:</p>
                        <a href={page.data.documentation} target="_blank" rel="noreferrer noopener">
                            {page.data.documentation}
                        </a>
                    </div>

                    {/* <Control url={page.url} /> */}
                </div>
            </article>
        </>
    );
}

export async function generateStaticParams() {
  return integration.getPages().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const params = await props.params;
  const page = integration.getPage(params.slug);

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