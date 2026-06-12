/**
 * Decorative grid pattern used as a background in docs and academy layouts.
 * The SVG itself lives in /public/decorative-grid.svg so it is fetched as a
 * static asset rather than inlined into every page (saves ~12 KB of HTML
 * per docs/academy page, improving Agent Score page-size and content-start
 * metrics).
 */
export function DecorativeGrid() {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 z-[-1] h-[64rem] max-h-screen overflow-hidden"
      style={{
        backgroundImage:
          'radial-gradient(49.63% 57.02% at 58.99% -7.2%, hsl(var(--primary)/0.1) 39.4%, transparent 100%)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/decorative-grid.svg"
        alt=""
        role="presentation"
        width={790}
        height={640}
        loading="lazy"
        decoding="async"
        className="absolute -top-16 left-1/2 -translate-x-1/2 pl-48"
      />
    </span>
  );
}
