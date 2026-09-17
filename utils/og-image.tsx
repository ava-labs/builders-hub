import { ImageResponse } from 'next/og';
import { OG_HEIGHT, OG_WIDTH } from '@/utils/og/sheet';
import { SectionCard } from '@/utils/og/section-card';

type OGProps = {
  title: string;
  description: string;
  path: string;
  icon?: React.ReactElement;
};

export function generateOGImage({ title, description, path, icon }: OGProps): React.ReactElement {
  return <SectionCard title={title} description={description} path={path} icon={icon} />;
}

// Helper function to load fonts
export async function loadFonts() {
  const medium = fetch(new URL('../app/api/og/Geist-Medium.ttf', import.meta.url)).then((res) =>
    res.arrayBuffer(),
  );

  const light = fetch(new URL('../app/api/og/Geist-Light.ttf', import.meta.url)).then((res) =>
    res.arrayBuffer(),
  );

  const regular = fetch(new URL('../app/api/og/GeistMono-Light.ttf', import.meta.url)).then((res) =>
    res.arrayBuffer(),
  );

  return {
    medium: await medium,
    light: await light,
    regular: await regular,
  };
}

// Create OG image response
export async function createOGResponse({
  title,
  description,
  path,
  icon,
  fonts,
}: OGProps & {
  fonts: { medium: ArrayBuffer; light: ArrayBuffer; regular: ArrayBuffer };
}): Promise<ImageResponse> {
  return new ImageResponse(generateOGImage({ title, description, path, icon }), {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts: [
      { name: 'Geist-Medium', data: fonts.medium, weight: 600 },
      { name: 'Geist-Mono', data: fonts.regular, weight: 500 },
      { name: 'Geist-Light', data: fonts.light, weight: 300 },
    ],
  });
}
