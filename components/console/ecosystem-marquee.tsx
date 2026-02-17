"use client";

interface Chain {
  name: string;
  image: string;
  link: string;
}

function MarqueeRow({ chains, direction = "left", speed = 60 }: { chains: Chain[]; direction?: "left" | "right"; speed?: number }) {
  const doubled = [...chains, ...chains];

  return (
    <div className="relative overflow-hidden">
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-r from-white dark:from-zinc-900 to-transparent" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none bg-gradient-to-l from-white dark:from-zinc-900 to-transparent" />

      <div
        className="flex gap-3 w-max hover:[animation-play-state:paused]"
        style={{ animation: `${direction === "left" ? "marquee" : "marquee-reverse"} ${speed}s linear infinite` }}
      >
        {doubled.map((chain, i) => (
          <a
            key={`${chain.name}-${i}`}
            href={chain.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-900 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors shrink-0"
          >
            <img
              src={chain.image}
              alt={chain.name}
              className="w-5 h-5 rounded-full object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
              {chain.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function EcosystemMarquee({ chains, rows = 1 }: { chains: Chain[]; rows?: 1 | 2 }) {
  if (rows === 1) {
    return <MarqueeRow chains={chains} direction="left" />;
  }

  const mid = Math.ceil(chains.length / 2);
  const row1 = chains.slice(0, mid);
  const row2 = chains.slice(mid);

  return (
    <div className="flex flex-col gap-2">
      <MarqueeRow chains={row1} direction="left" speed={55} />
      <MarqueeRow chains={row2} direction="right" speed={65} />
    </div>
  );
}
