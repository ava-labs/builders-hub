'use client';

/**
 * "Exit to game select" button. Rendered inside `<GameControls>` which
 * owns the absolute positioning so it sits in a flex row alongside the
 * mute toggle without overlapping.
 *
 * `stopPropagation` is required because the game canvas has an outer
 * onClick that triggers jump/flap/restart — without it, pressing the
 * button would also fire a game action as it bubbles.
 */
export function GameExitButton({ onExit }: { onExit: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onExit();
      }}
      className="flex items-center gap-1 border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950 px-1.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
      aria-label="View games"
      title="View games"
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
      <span>View games</span>
    </button>
  );
}
