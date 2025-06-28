import Link from 'next/link';

export const CTASection = () => (
  <section className="relative py-24 px-4">
    <div className="absolute inset-0 bg-gradient-to-r from-[#EB4C50]/5 to-orange-500/5 rounded-3xl backdrop-blur-sm " />
    <div className="relative px-8 py-16 text-center space-y-6 rounded-3xl max-w-4xl mx-auto">
      <h2 className="text-3xl md:text-5xl font-bold">Ready to Build Your L1?</h2>
      <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
        Start building your high-performance L1 blockchain with Avalanche's battle-tested infrastructure and tooling.
      </p>
      
      <div className="flex gap-4 justify-center mb-16">
        <Link
          href="/docs"
          className="bg-black hover:bg-black/75 dark:bg-white dark:hover:bg-white/75 text-white dark:text-black px-4 py-2 rounded-lg text-sm font-semibold transition-colors dark:bg-opacity-90"
        >
          Get Started
        </Link>
        <a
          href="https://github.com/ava-labs/builderkit"
          className="bg-white dark:bg-black border border-[0.5] border-black/25 dark:border-white/25 dark:hover:border-white/50 hover:border-black/50 dark:text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </div>
  </section>
); 