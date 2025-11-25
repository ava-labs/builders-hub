import Hero, { HeroBackground } from '@/components/landing/hero';
import Paths from '@/components/landing/paths';
import QuickLinks from '@/components/landing/quicklinks';

export default function HomePage(): React.ReactElement {
  return (
    <>
      <HeroBackground />
      <Hero />
      <main className="container relative max-w-[1100px] px-2 py-4 lg:py-16">
        <QuickLinks />
        {/* <Paths /> */}
      </main>
    </>
  );
}