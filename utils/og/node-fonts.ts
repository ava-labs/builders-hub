import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Font loading for og routes on the Node runtime (the live-data cards).
 * Literal process.cwd() joins so Vercel's file tracing bundles the TTFs.
 */
export async function loadNodeFonts() {
  const [medium, mono] = await Promise.all([
    readFile(join(process.cwd(), 'app/api/og/Geist-Medium.ttf')),
    readFile(join(process.cwd(), 'app/api/og/GeistMono-Light.ttf')),
  ]);
  return [
    { name: 'Geist-Medium', data: medium, weight: 600 as const },
    { name: 'Geist-Mono', data: mono, weight: 500 as const },
  ];
}
