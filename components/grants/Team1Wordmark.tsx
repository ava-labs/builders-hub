/**
 * The "Team1" wordmark, used in place of the literal text "Team1" in headings.
 *
 * The supplied asset (`/team1/text-logo.svg`) is white + red — designed for dark
 * backgrounds. On the light-mode `bg-background` the white would be invisible, so
 * in light mode we apply `invert(1) hue-rotate(180deg)`: white → near-black (stays
 * readable) while the red accent rotates back to ~red. In dark mode we use it as-is.
 *
 * Height is sized in `em` so the logo scales with the surrounding text — pass an
 * `h-[..em]` class to tune it per heading. `alt="Team1"` keeps the heading reading
 * as "Team1 Mini Grants" for screen readers.
 */
export function Team1Wordmark({ className = "h-[0.8em]" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/team1/text-logo.svg"
      alt="Team1"
      className={`inline-block w-auto align-[-0.1em] [filter:invert(1)_hue-rotate(180deg)] dark:[filter:none] ${className}`}
    />
  );
}

/**
 * The square Team1 symbol mark. Same white+red asset and the same light/dark
 * treatment as {@link Team1Wordmark}. Pass `h-/w-` classes to size it.
 */
export function Team1Symbol({ className = "h-8 w-8" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/team1/symbol-logo.svg"
      alt="Team1"
      className={`[filter:invert(1)_hue-rotate(180deg)] dark:[filter:none] ${className}`}
    />
  );
}
