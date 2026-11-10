import { SquareTerminal } from 'lucide-react';

/**
 * The caption row above an embedded console tool: the terminal tile and "Interactive exercise".
 * The frame's own header already names the Builder Console, so the caption does not.
 */
export function ConsoleExerciseCaption() {
  return (
    <div className="mt-7 mb-2.5 flex items-center gap-2.5 text-[13.5px]">
      <span
        aria-hidden="true"
        className="inline-flex size-7 flex-none items-center justify-center rounded-lg bg-ac-tile text-ac-ink"
      >
        <SquareTerminal className="size-[15px]" strokeWidth={1.9} />
      </span>
      <span className="font-semibold text-ac-ink">Interactive exercise</span>
    </div>
  );
}
