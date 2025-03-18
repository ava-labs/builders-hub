import Hero from '@/components/landing/hero';
import Features from '@/components/landing/features';
import Development from '@/components/landing/development';
import Ecosystem from '@/components/landing/ecosystem';
import Support from '@/components/landing/support';

export default function HomePage(): React.ReactElement {
  return (
    <>
      <Hero />
      <main className="container relative max-w-[1100px] px-2 py-4 lg:py-16">
          <Features />
          <Development />
          <Ecosystem />
          <Support />
      </main>
    </>
  );
}