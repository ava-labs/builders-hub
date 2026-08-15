import type { FlowDefinition } from "./data/types";

export function FlowHero({ flow }: { flow: FlowDefinition }) {
  return (
    <div className="mb-5">
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        L1 OPERATIONS / VALIDATOR MANAGER
      </div>
      <h2 className="v2-display mt-2 text-3xl text-zinc-900 md:text-4xl dark:text-zinc-50">
        {flow.heroTitle}
        <span className="text-[#E6212F]">.</span>
      </h2>
    </div>
  );
}
