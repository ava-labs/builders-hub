import { cn } from "@/lib/utils";

type BlocksSize = "sm" | "md" | "lg";
type BlocksVariant = "cascade" | "corner" | "stack";
type BlocksPalette = "page" | "plate";

interface BlocksArtProps {
  /** Blocks in the first row; row i renders (cols - i) blocks. */
  cols?: 2 | 3 | 4;
  rows?: 2 | 3 | 4;
  size?: BlocksSize;
  /** cascade = left-aligned, rows step right (marketing surfaces).
      corner = right-aligned, for the top-right of dark plates.
      stack = left-flush shrinking rows (the sign-in panel, board 1a). */
  variant?: BlocksVariant;
  /** page follows the theme; plate uses the fixed board hues for
      always-dark surfaces (#121212 / #1F1F1F plates). */
  palette?: BlocksPalette;
  className?: string;
}

const UNIT: Record<BlocksSize, string> = {
  sm: "h-2.5 w-[26px]",
  md: "h-2.5 w-[30px]",
  lg: "h-5 w-14",
};

const INDENT: Record<BlocksSize, number> = { sm: 26, md: 30, lg: 56 };

/* Hue by diagonal (row + col), the rule every board cascade follows. */
const HUES: Record<BlocksPalette, string[]> = {
  page: [
    "bg-brand",
    // Dark keeps the guideline slate instead of inverted ink: a near-white
    // block on a dark page read as a fourth, alien hue (Federico, round 3).
    "bg-zinc-900 dark:bg-[#3B484B]",
    "bg-zinc-200 dark:bg-white/15",
    "bg-zinc-100 dark:bg-white/10",
  ],
  plate: ["bg-brand", "bg-[#3B484B]", "bg-[#1F1F1F]", "bg-[#181818]"],
};

/**
 * Digital-blocks cascade (Avalanche guidelines; board 1f / 1a / 3a corners).
 * Single source for the motif: landing hero, first-run, sign-in, and the
 * dark-plate corners on receipt / fan-out / worksheet. Accents, never
 * wallpaper.
 */
export function BlocksArt({
  cols = 3,
  rows = 3,
  size = "md",
  variant = "cascade",
  palette = "page",
  className,
}: BlocksArtProps) {
  const hues = HUES[palette];
  return (
    <div
      aria-hidden
      className={cn(
        "inline-flex flex-col",
        variant === "corner" ? "items-end" : "items-start",
        className,
      )}
    >
      {Array.from({ length: rows }, (_, row) => {
        const count = Math.max(cols - row, 1);
        return (
          <div
            key={row}
            className="flex"
            style={
              variant === "cascade" && row > 0 ? { marginLeft: row * INDENT[size] } : undefined
            }
          >
            {Array.from({ length: count }, (_, col) => (
              <span
                key={col}
                className={cn(UNIT[size], hues[Math.min(row + col, hues.length - 1)])}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
