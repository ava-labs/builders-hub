import { type NextRequest, NextResponse } from 'next/server';
import { getLLMText } from '@/lib/getLLMText';
import { documentation, academy, guide, integration } from '@/lib/source';
import { notFound } from 'next/navigation';

export const revalidate = false;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;
  
  if (!slug || slug.length === 0) {
    notFound();
  }
  
  // Determine which source to use based on the first segment
  const [section, ...restSlug] = slug;
  
  // Try to find the page in the appropriate source
  if (section === 'docs') {
    // First try with the slug as-is
    let page = documentation.getPage(restSlug);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
    
    // Try with index appended
    page = documentation.getPage([...restSlug, 'index']);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
  } else if (section === 'academy') {
    // First try with the slug as-is
    let page = academy.getPage(restSlug);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
    
    // Try with index appended
    page = academy.getPage([...restSlug, 'index']);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
  } else if (section === 'guides') {
    // First try with the slug as-is
    let page = guide.getPage(restSlug);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
    
    // Try with index appended
    page = guide.getPage([...restSlug, 'index']);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
  } else if (section === 'integrations') {
    // First try with the slug as-is
    let page = integration.getPage(restSlug);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
    
    // Try with index appended
    page = integration.getPage([...restSlug, 'index']);
    if (page) {
      return new NextResponse(await getLLMText(page));
    }
  }
  
  notFound();
}

export function generateStaticParams() {
  // Combine params from all sources, adding the section prefix
  return [
    ...documentation.generateParams().map(params => ({
      slug: ['docs', ...params.slug]
    })),
    ...academy.generateParams().map(params => ({
      slug: ['academy', ...params.slug]
    })),
    ...guide.generateParams().map(params => ({
      slug: ['guides', ...params.slug]
    })),
    ...integration.generateParams().map(params => ({
      slug: ['integrations', ...params.slug]
    })),
  ];
}