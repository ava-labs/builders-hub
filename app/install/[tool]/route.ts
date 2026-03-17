import { NextRequest, NextResponse } from 'next/server';

/**
 * Registry of install scripts hosted on GitHub.
 * Add new tools here as { tool-slug: raw-github-url }.
 */
const INSTALL_SCRIPTS: Record<string, string> = {
  'platform-cli': 'https://raw.githubusercontent.com/ava-labs/platform-cli/main/install.sh',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  const { tool } = await params;
  const scriptUrl = INSTALL_SCRIPTS[tool];

  if (!scriptUrl) {
    return new NextResponse(`Unknown tool: ${tool}\nAvailable: ${Object.keys(INSTALL_SCRIPTS).join(', ')}\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  try {
    const response = await fetch(scriptUrl, {
      next: { revalidate: 3600 }, // revalidate cached script every hour
    });

    if (!response.ok) {
      return new NextResponse(`Failed to fetch install script (upstream ${response.status})\n`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const script = await response.text();

    return new NextResponse(script, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse('Failed to fetch install script\n', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
