import Hero, { HeroBackground } from '@/components/landing/hero';
import Features from '@/components/landing/features';
import Paths from '@/components/landing/paths';
import QuickLinks from '@/components/landing/quicklinks';
import AcademySplash from '@/components/landing/academy-splash';
import Development from '@/components/landing/development';
import Ecosystem from '@/components/landing/ecosystem';
import Support from '@/components/landing/support';
import Grow from '@/components/landing/grow';

export default function HomePage(): React.ReactElement {
  return (
    <>
      <HeroBackground />
      <Hero />
              <main className="container relative max-w-[1100px] px-2 py-4 lg:py-16">
            {/* <Features /> */}
            <Paths />
            <QuickLinks />
            <AcademySplash />
            {/* <Development /> */}
            {/* <Grow /> */}
        </main>
    </>
  );
}