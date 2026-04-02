import Hero, { HeroBackground } from '@/components/landing/hero';
import Paths from '@/components/landing/paths';
import QuickLinks from '@/components/landing/quicklinks';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://build.avax.network';

async function getGlobeData() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const [metricsRes, icmRes] = await Promise.all([
      fetch(`${BASE_URL}/api/overview-stats?timeRange=day`, {
        next: { revalidate: 3600 },
        signal: controller.signal,
      }),
      fetch(`${BASE_URL}/api/icm-flow?days=30`, {
        next: { revalidate: 3600 },
        signal: controller.signal,
      }),
    ]);

    clearTimeout(timeout);

    const [metrics, icmData] = await Promise.all([
      metricsRes.ok ? metricsRes.json() : null,
      icmRes.ok ? icmRes.json() : null,
    ]);

    return {
      metrics,
      icmFlows: icmData?.flows || [],
    };
  } catch (error) {
    console.error('Failed to fetch globe data:', error);
    return { metrics: null, icmFlows: [] };
  }
}

export default async function HomePage(): Promise<React.ReactElement> {
  const globeData = await getGlobeData();

  return (
    <>
      <HeroBackground />
      <Hero globeData={globeData} />
      <main className="relative py-4 lg:py-16">
        <QuickLinks />
        {/* <Paths /> */}
      </main>
    </>
  );
}