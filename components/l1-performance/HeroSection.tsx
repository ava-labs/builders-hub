import { AvalancheLogo } from '@/components/navigation/avalanche-logo';

export const HeroSection = () => (
  <section className="text-center space-y-6 pt-12 pb-24">
    <div className="flex justify-center mb-6">
      <AvalancheLogo className="w-16 h-16 text-[#EB4C50]" />
    </div>
    <h1 className="text-4xl md:text-7xl font-bold tracking-tighter">
      L1 Performance
      <span className="block pb-1 text-[#EB4C50]">
        Fact Sheet
      </span>
    </h1>
    <p className="text-lg text-foreground mb-12 max-w-3xl mx-auto">
      Discover the cutting-edge performance metrics and capabilities of our L1 blockchain solution, 
      designed for maximum throughput, minimal latency, and seamless interoperability.
    </p>
  </section>
); 