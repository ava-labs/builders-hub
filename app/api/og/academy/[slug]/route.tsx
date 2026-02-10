import type { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';
import { loadFonts, createOGResponse } from '@/utils/og-image';

export const runtime = 'edge';

function AvalancheIcon() {
  return (
    <svg
      width="180"
      height="160"
      viewBox="329 0 272 230"
      fill="none"
    >
      <path
        fill="#E84142"
        d="M532.763 137.242C536.794 130.375 546.806 130.375 550.793 137.242L593.631 210.426C597.662 217.292 592.612 225.842 584.594 225.842H498.917C490.899 225.842 485.893 217.292 489.88 210.426L532.718 137.242H532.763Z"
      />
      <path
        fill="#E84142"
        d="M506.887 88.5117C510.785 81.6895 510.785 73.2724 506.887 66.4059L471.757 5.09425C467.814 -1.7723 457.979 -1.7723 454.037 5.09425L336.464 210.338C332.521 217.204 337.438 225.798 345.324 225.798H415.54C423.381 225.798 430.602 221.59 434.5 214.768L506.843 88.4674L506.887 88.5117Z"
      />
    </svg>
  );
}

function SolidityIcon() {
  return (
    <svg
      width="130"
      height="180"
      viewBox="-25 130 535 825"
      fill="none"
    >
      <path fill="#363636" opacity={0.45} d="M371.772,135.308L241.068,367.61H-20.158l130.614-232.302H371.772" />
      <path fill="#363636" opacity={0.6} d="M241.068,367.61h261.318L371.772,135.308H110.456L241.068,367.61z" />
      <path fill="#363636" opacity={0.8} d="M110.456,599.822L241.068,367.61L110.456,135.308L-20.158,367.61L110.456,599.822z" />
      <path fill="#363636" opacity={0.45} d="M111.721,948.275l130.704-232.303h261.318L373.038,948.275H111.721" />
      <path fill="#363636" opacity={0.6} d="M242.424,715.973H-18.893l130.613,232.303h261.317L242.424,715.973z" />
      <path fill="#363636" opacity={0.8} d="M373.038,483.761L242.424,715.973l130.614,232.303l130.704-232.303L373.038,483.761z" />
    </svg>
  );
}

function GraduationCapIcon() {
  return (
    <svg
      width="180"
      height="180"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#363636"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6" />
      <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  );
}

const sectionConfig: Record<string, { icon: () => React.ReactElement; path: string }> = {
  'avalanche-l1': { icon: AvalancheIcon, path: 'academy/avalanche-l1' },
  'blockchain': { icon: SolidityIcon, path: 'academy/blockchain' },
  'entrepreneur': { icon: GraduationCapIcon, path: 'academy/entrepreneur' },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<ImageResponse> {
  const { slug } = await params;
  const { searchParams } = request.nextUrl;
  const rawTitle = searchParams.get('title');
  // Remove the suffix if present
  const title = rawTitle?.replace(/\s*\|\s*Avalanche Builder Hub$/, '');
  const description = searchParams.get('description');

  const fonts = await loadFonts();

  const section = sectionConfig[slug];
  const icon = section?.icon();
  const path = section?.path ?? 'academy';

  return createOGResponse({
    title: title ?? 'Academy',
    description: description ?? 'Learn blockchain development with courses designed for the Avalanche ecosystem',
    path,
    icon,
    fonts
  });
}
