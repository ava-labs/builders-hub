import { MARKET_CAP } from "./content";
import { BESU_CHART, FONT_MONO, type BesuChartTheme } from "./tokens";

/**
 * Market cap by network — exploded pie. SELF-CONTAINED BY DESIGN.
 *
 * No chart library and no client boundary. The page exists so it can be lifted
 * to another site as a copy rather than a refactor, so a charting package would
 * put an install between the page and its next home; and with no toggle there
 * is no state, so this stays a server component like the rest of the page.
 *
 * FORM. The pie matches the form the source publishes, which is the point: a
 * reader can hold this next to rwa.xyz and check it without translating between
 * shapes. The cost is real and worth naming — Solana and Avalanche are 0.9
 * points apart and their wedges are all but identical by angle. That is why the
 * ordering discipline below is not optional.
 *
 * HONESTY CONSTRAINTS, all load-bearing:
 *  - Ethereum renders at full radius. Never shrink or crop the largest wedge.
 *  - Nothing here, and nothing placed next to it, may call Avalanche "second".
 *    It is third, by $24.3M. The numbers are public and take seconds to check.
 *  - One day's snapshot. No growth, trend or momentum language.
 *  - Source and as-of date render inside the figure.
 *  - The table always renders and carries all five networks, so the folded tail
 *    is recoverable. It is also what makes the palette's palest step compliant.
 *
 * GEOMETRY. Angles start at twelve o'clock and run clockwise, so every wedge is
 * large-arc-flag 0, sweep-flag 1. Sweeps: 164.6465°, 89.9381°, 86.6041°,
 * 18.8107°, summing to 360.0000°. Avalanche is DISPLACED, never enlarged: its
 * radius is identical to the other three and its arc is struck from a centre
 * shifted 22 along its own midangle of 207.8867°, i.e. by
 * (cos, sin) = (−0.88371, −0.46804) × 22 = (−19.44, −10.30).
 *
 * Every coordinate is a pre-rounded literal — computed values hydrate
 * differently between server and client. These match the authoritative check
 * values from the copy owner exactly. Ink spans x[30.6,350] y[47.7,350] inside
 * a 400×400 box.
 */

const PIE_VIEWBOX = "0 0 400 400";

/**
 * `labelInk` is chosen per wedge from the fill's luminance, not set globally.
 * White on the mid neutral is only 3.76:1 and fails AA for text this size;
 * black on it is 5.58:1. Measured: white on #3F4E54 8.65:1, black on #78868B
 * 5.58:1, white on #E6212F 4.54:1. Re-measure if a fill ever changes.
 */
const WEDGES = [
  {
    key: "Ethereum",
    d: "M200,200 L200,50 A150,150 0 0,1 239.76,344.64 Z",
    share: "45.7%",
    label: { x: 289, y: 188 },
    labelInk: "#FFFFFF",
    neutralStep: 0,
  },
  {
    key: "Solana",
    d: "M200,200 L239.76,344.64 A150,150 0 0,1 55.40,239.90 Z",
    share: "25.0%",
    label: { x: 155.5, y: 278 },
    labelInk: "#000000",
    neutralStep: 1,
  },
  {
    key: "Avalanche C-Chain",
    d: "M180.56,189.70 L35.96,229.60 A150,150 0 0,1 132.13,47.73 Z",
    share: "24.1%",
    label: { x: 101, y: 147.6 },
    labelInk: "#FFFFFF",
    // No neutralStep: this wedge takes the accent, and leaving the field off
    // is what lets the union narrow in fillFor below.
    accent: true,
  },
  {
    // 18.81° cannot hold a label without clipping it, so this wedge carries
    // its share in the legend instead of inside the mark.
    key: "Other",
    d: "M200,200 L151.57,58.03 A150,150 0 0,1 200,50 Z",
    share: "5.2%",
    label: null,
    labelInk: "#000000",
    neutralStep: 2,
  },
] as const;

export function MarketCapChart({ theme = "light" }: { theme?: BesuChartTheme }) {
  const c = BESU_CHART[theme];
  const onDark = theme === "dark";
  const ink = onDark ? "text-white" : "text-[var(--besu-ink)]";
  const quiet = onDark ? "text-[var(--besu-grey)]" : "text-[var(--besu-slate)]";
  const rule = onDark
    ? "border-[var(--besu-hairline-dark)]"
    : "border-[var(--besu-hairline-table)]";

  /* `"accent" in w` alone is the discriminant. Writing `"accent" in w &&
     w.accent` would not narrow the false branch, because the negation of a
     conjunction still admits the member that has the field. */
  const fillFor = (w: (typeof WEDGES)[number]) =>
    "accent" in w ? c.accent : c.neutral[w.neutralStep];

  /** Legend value for a wedge: the folded tail has no single table row. */
  const valueFor = (key: string) =>
    key === "Other"
      ? MARKET_CAP.otherDisplay
      : MARKET_CAP.rows.find((r) => r.network === key)?.display;

  return (
    <figure className="m-0">
      <figcaption
        className={`${FONT_MONO} text-[10px] font-medium uppercase tracking-[0.14em] ${quiet}`}
      >
        {MARKET_CAP.title}
      </figcaption>

      {/* Deliberately loud, deliberately not dismissable. The number is not
          cleared for publication; this marker is what stops it going out. */}
      <p
        className={`${FONT_MONO} mt-2 inline-block border border-[var(--besu-red)] px-2 py-1 text-[9px] font-medium tracking-[0.12em] text-[var(--besu-red)]`}
      >
        {MARKET_CAP.unverified.flag}
      </p>

      <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:items-center sm:gap-10">
        <svg
          viewBox={PIE_VIEWBOX}
          role="img"
          aria-label="Market cap by network as a share of the labelled total. Ethereum 45.7 percent, 1,200.0 million dollars. Solana 25.0 percent, 655.5 million dollars. Avalanche C-Chain 24.1 percent, 631.2 million dollars. All other networks combined 5.2 percent, 137.1 million dollars."
          className="h-auto w-full max-w-[300px] shrink-0"
        >
          {WEDGES.map((w) => (
            <path
              key={w.key}
              d={w.d}
              fill={fillFor(w)}
              /* A 2px separator in the surface colour, per the mark spec —
                 a gap between fills, not a border drawn around each mark. */
              stroke={c.gap}
              strokeWidth={2}
            />
          ))}
          {WEDGES.map((w) =>
            w.label ? (
              <text
                key={w.key}
                x={w.label.x}
                y={w.label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={18}
                fontWeight={600}
                fill={w.labelInk}
                className={FONT_MONO}
              >
                {w.share}
              </text>
            ) : null,
          )}
        </svg>

        {/* Legend. Four wedges, so identity never rests on colour alone: three
            are direct-labelled inside and all four are named here with their
            value and share. */}
        <ul className="m-0 w-full list-none space-y-3 p-0">
          {WEDGES.map((w) => (
            <li key={w.key} className="flex items-center gap-3">
              <span
                aria-hidden
                className="h-[10px] w-[10px] shrink-0"
                style={{ backgroundColor: fillFor(w) }}
              />
              <span className={`${FONT_MONO} text-[10px] tracking-[0.1em] ${quiet}`}>
                {w.key}
              </span>
              <span
                className={`${FONT_MONO} ml-auto text-[11px] tabular-nums ${ink}`}
              >
                {valueFor(w.key)}
              </span>
              <span
                className={`${FONT_MONO} w-[46px] shrink-0 text-right text-[11px] tabular-nums ${quiet}`}
              >
                {w.share}
              </span>
            </li>
          ))}
          {/* Says where the folded tail went, at the point the fold is read
              rather than only in the table below it. */}
          <li className={`${FONT_MONO} pt-1 text-[9px] tracking-[0.1em] ${quiet}`}>
            {MARKET_CAP.foldNote}
          </li>
        </ul>
      </div>

      {/* Source and as-of date, inside the figure by requirement. */}
      <p className={`${FONT_MONO} mt-6 text-[9px] tracking-[0.1em] ${quiet}`}>
        {MARKET_CAP.source}
      </p>

      {/* Always rendered, never behind a control: it carries the two networks
          the pie folds away, and the palette's sub-3:1 step is only compliant
          because this exists. */}
      <table className="mt-5 w-full border-collapse text-left">
        <caption className="sr-only">
          Market cap by network, all five networks itemised. {MARKET_CAP.source}
        </caption>
        <thead>
          <tr className={`${FONT_MONO} border-b ${rule}`}>
            <th
              scope="col"
              className={`py-2 pr-4 text-[9px] font-medium uppercase tracking-[0.12em] ${quiet}`}
            >
              Network
            </th>
            <th
              scope="col"
              className={`py-2 pr-4 text-right text-[9px] font-medium uppercase tracking-[0.12em] ${quiet}`}
            >
              Market cap
            </th>
            <th
              scope="col"
              className={`py-2 text-right text-[9px] font-medium uppercase tracking-[0.12em] ${quiet}`}
            >
              Share
            </th>
          </tr>
        </thead>
        <tbody>
          {MARKET_CAP.rows.map((row) => {
            /* The accented row is emphasised, never ranked. Rows stay in
               descending value order so the ordering above us is plain to
               read — that is the mitigation for the wedge ambiguity, and it
               is why nothing here numbers the rows. */
            const isAccent = row.network === MARKET_CAP.accentNetwork;
            return (
              <tr key={row.network} className={`border-b ${rule}`}>
                <th
                  scope="row"
                  className={`py-2 pr-4 text-[12px] ${isAccent ? "font-semibold" : "font-normal"} ${ink}`}
                >
                  {row.network}
                </th>
                <td
                  className={`py-2 pr-4 text-right text-[12px] tabular-nums ${isAccent ? "font-semibold" : ""} ${ink}`}
                >
                  {row.display}
                </td>
                <td
                  className={`py-2 text-right text-[12px] tabular-nums ${isAccent ? ink : quiet}`}
                >
                  {row.share}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={`py-2 pr-4 text-[12px] font-normal ${quiet}`}>
              {MARKET_CAP.totalLabel}
            </th>
            <td className={`py-2 pr-4 text-right text-[12px] tabular-nums ${quiet}`}>
              {MARKET_CAP.totalDisplay}
            </td>
            <td className={`py-2 text-right text-[12px] tabular-nums ${quiet}`}>
              {MARKET_CAP.totalShare}
            </td>
          </tr>
        </tfoot>
      </table>

      <p className={`mt-3 text-[12px] leading-[1.6] ${quiet}`}>
        {MARKET_CAP.footnote}
      </p>
      <p className="mt-2 text-[12px] leading-[1.6] text-[var(--besu-red)]">
        {MARKET_CAP.unverified.note}
      </p>
    </figure>
  );
}
