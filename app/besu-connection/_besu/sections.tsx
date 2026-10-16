import Image from "next/image";
import { BESU_ASSETS, BESU_LOGO_SIZE } from "./assets";
import {
  ALTERNATIVES,
  CONTROL,
  CTA,
  DESTINATION,
  FOOTER,
  HERO,
  MECHANISM,
  NAV_CTA,
  NAV_LINKS,
  SUMMARY,
  VISIBILITY,
} from "./content";
import { MarketCapChart } from "./MarketCapChart";
import { ButtonRow, RailHeading, SectionHeading, railLines } from "./primitives";
import {
  BESU_CONTAINER,
  BESU_SCROLL_OFFSET,
  FONT_DISPLAY,
  FONT_MONO,
} from "./tokens";

/**
 * The ten sections of the Besu connection page. SELF-CONTAINED BY DESIGN.
 *
 * Only `next/image` is imported from outside this folder, and that is a
 * framework primitive rather than a Builder Hub component. Nothing here
 * depends on the host repo, so the page lifts out cleanly. That includes the
 * chart: it is hand-drawn SVG and CSS rather than a charting library, so the
 * folder still moves as a copy rather than a package install.
 *
 * The reference prototype had no responsive behaviour; the breakpoints below
 * come from the handoff's responsive notes. Below lg, four-column hairline
 * grids collapse to two and then one, rail grids stack, and the comparison
 * table scrolls horizontally rather than crushing.
 */

/* ---------------- 1. Sticky header ---------------- */

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--besu-hairline-dark)] bg-[var(--besu-ink)]">
      <div
        className={`${BESU_CONTAINER} flex items-center justify-between py-4`}
      >
        <Image
          src={BESU_ASSETS.logoWhite}
          alt="Avalanche"
          width={BESU_LOGO_SIZE.width}
          height={BESU_LOGO_SIZE.height}
          priority
          /* Shrinks below sm to buy room for the CTA label — see the note on
             the CTA below. */
          className="block h-[18px] w-auto sm:h-[22px]"
        />
        <nav
          className={`${FONT_MONO} flex items-center gap-4 text-[10px] font-medium tracking-[0.14em] text-[var(--besu-grey)] sm:gap-7`}
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hidden transition-colors duration-150 hover:text-white sm:block"
            >
              {link.label}
            </a>
          ))}
          {/* The single ask, at 27 characters, is a tight fit in a sticky bar
              that also carries the logo. Below sm it drops to 9px with reduced
              tracking and padding; that fits a 360px viewport with ~12px to
              spare and overflows below about 340px. Flagged rather than
              shortened, because one label everywhere was the instruction. */}
          <a
            href={NAV_CTA.href}
            className="whitespace-nowrap bg-[var(--besu-red)] px-2.5 py-2 text-[9px] tracking-[0.08em] text-white transition-colors duration-150 hover:bg-[var(--besu-red-dark)] sm:px-[14px] sm:text-[10px] sm:tracking-[0.14em]"
          >
            {NAV_CTA.label}
          </a>
        </nav>
      </div>
    </header>
  );
}

/* ---------------- 2. Hero ---------------- */

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-[var(--besu-ink)]">
      {/* Vertical rule grid, 100px pitch. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[length:100px_100%]"
      />
      {/* Right 44%: texture under a left-to-right scrim. */}
      <div aria-hidden className="absolute inset-y-0 right-0 w-[44%]">
        <Image
          src={BESU_ASSETS.heroTexture}
          alt=""
          fill
          priority
          sizes="44vw"
          className="object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--besu-ink)_0%,rgba(31,31,31,.55)_45%,rgba(31,31,31,.2)_100%)]" />
      </div>

      <div className={`${BESU_CONTAINER} relative pb-[90px] pt-[110px]`}>
        <p
          className={`${FONT_MONO} mb-[34px] text-[11px] font-medium tracking-[0.18em] text-[var(--besu-red-bright)]`}
        >
          {HERO.eyebrow}
        </p>
        <h1
          className={`${FONT_DISPLAY} m-0 max-w-[900px] text-[clamp(40px,10vw,72px)] font-black uppercase leading-[0.94] tracking-[-0.03em] text-white [text-wrap:balance]`}
        >
          {HERO.headingLine1}
          <br />
          {HERO.headingLine2}
          <span className="text-[var(--besu-red)]">.</span>
        </h1>
        <p className="mt-[34px] max-w-[560px] text-[19px] leading-[1.55] text-[var(--besu-grey)] [text-wrap:pretty]">
          {HERO.deck}
        </p>

        <div className="mt-11">
          <ButtonRow primary={HERO.primaryCta} secondary={HERO.secondaryCta} />
        </div>

        <div className="mt-[70px] grid max-w-[820px] grid-cols-1 gap-8 border-t border-[var(--besu-hairline-dark-strong)] pt-[22px] sm:grid-cols-3">
          {HERO.stats.map((stat) => (
            <div key={stat.caption}>
              <div
                className={`${FONT_DISPLAY} whitespace-pre-line text-[30px] font-black tracking-[-0.02em] text-white`}
              >
                {stat.label}
              </div>
              <div className="mt-2 text-[13px] leading-[1.5] text-[var(--besu-grey)]">
                {stat.caption}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- 3. In summary ---------------- */

export function Summary() {
  return (
    <section className={`${BESU_CONTAINER} pt-[90px]`}>
      <div className="mb-10">
        <RailHeading rail={SUMMARY.rail}>
          <SectionHeading>{SUMMARY.heading}</SectionHeading>
        </RailHeading>
      </div>
      <div className="grid grid-cols-1 gap-px bg-[var(--besu-hairline)] sm:grid-cols-2 lg:grid-cols-4">
        {SUMMARY.cards.map((card) => (
          <div key={card.eyebrow} className="bg-white px-[26px] py-[30px]">
            <div
              className={`${FONT_MONO} mb-[18px] text-[10px] font-medium tracking-[0.14em] text-[var(--besu-red)]`}
            >
              {card.eyebrow}
            </div>
            <div className="text-[14px] leading-[1.65] text-[var(--besu-ink)] [text-wrap:pretty]">
              {card.body}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- 4. What the destination gives you ---------------- */

/**
 * Sells the destination, which is this page's job now that the mechanism
 * argument lives at /solutions/patterns/external-evm-icm.
 *
 * The chart claims the full width because it is the centrepiece of the
 * ecosystem argument; the other three items sit three-across in the same
 * hairline grid the Visibility section uses. `MarketCapChart` is hand-drawn
 * SVG with no state, so the page stays entirely server-rendered — there is no
 * client boundary anywhere in this folder, and adding one should be a
 * deliberate decision rather than a side effect.
 */
export function Destination() {
  return (
    <section className={`${BESU_CONTAINER} pt-[90px]`}>
      <RailHeading rail={railLines(DESTINATION.rail)}>
        <div className="mb-8">
          <SectionHeading>{DESTINATION.heading}</SectionHeading>
        </div>

        <div className="border border-[var(--besu-hairline)] bg-white px-6 py-7 sm:px-8 sm:py-8">
          <div
            className={`${FONT_MONO} mb-[14px] text-[10px] font-medium tracking-[0.12em] text-[var(--besu-red)]`}
          >
            {DESTINATION.presence.eyebrow}
          </div>
          <p className="m-0 mb-8 max-w-[680px] text-[15px] leading-[1.7] text-[var(--besu-ink)] [text-wrap:pretty]">
            {DESTINATION.presence.body}
          </p>
          <MarketCapChart theme="light" />
        </div>

        <div className="mt-px grid grid-cols-1 gap-px border border-[var(--besu-hairline)] bg-[var(--besu-hairline)] sm:grid-cols-2 lg:grid-cols-3">
          {DESTINATION.items.map((item) => (
            <div key={item.eyebrow} className="bg-white px-6 py-7">
              <div
                className={`${FONT_MONO} mb-[14px] text-[10px] font-medium tracking-[0.12em] text-[var(--besu-slate)]`}
              >
                {item.eyebrow}
              </div>
              <div className="text-[14px] leading-[1.65] text-[var(--besu-ink)] [text-wrap:pretty]">
                {item.body}
              </div>
            </div>
          ))}
        </div>
      </RailHeading>
    </section>
  );
}

/* ---------------- 5. Mechanism ---------------- */

export function Mechanism() {
  return (
    <section
      id="mechanism"
      className={`${BESU_SCROLL_OFFSET} ${BESU_CONTAINER} pt-[90px]`}
    >
      <RailHeading rail={railLines(MECHANISM.rail)}>
        <div className="mb-6">
          <SectionHeading>{MECHANISM.heading}</SectionHeading>
        </div>
        <div className="grid max-w-[860px] grid-cols-1 gap-7 md:grid-cols-2">
          {MECHANISM.prose.map((para) => (
            <p
              key={para.slice(0, 24)}
              className="m-0 text-[15px] leading-[1.7] text-[var(--besu-ink)] [text-wrap:pretty]"
            >
              {para}
            </p>
          ))}
        </div>

        <div
          className={`${FONT_MONO} mb-[14px] mt-[38px] text-[10px] font-medium tracking-[0.14em] text-[var(--besu-slate)]`}
        >
          {MECHANISM.subLabel}
        </div>
        <div className="grid grid-cols-1 gap-px border border-[var(--besu-hairline)] bg-[var(--besu-hairline)] sm:grid-cols-2 lg:grid-cols-4">
          {MECHANISM.limits.map((cell) => (
            <div
              key={cell.eyebrow}
              className="bg-[var(--besu-surface)] px-5 py-6"
            >
              <div
                className={`${FONT_MONO} mb-3 text-[10px] font-medium tracking-[0.12em] text-[var(--besu-red)]`}
              >
                {cell.eyebrow}
              </div>
              <div className="text-[13px] leading-[1.6] text-[var(--besu-ink)]">
                {cell.body}
              </div>
            </div>
          ))}
        </div>
      </RailHeading>
    </section>
  );
}

/* ---------------- 6. Control (dark) ---------------- */

export function Control() {
  return (
    <section
      id="control"
      className={`${BESU_SCROLL_OFFSET} mt-[90px] bg-[var(--besu-ink)]`}
    >
      <div className={`${BESU_CONTAINER} py-[90px]`}>
        <RailHeading rail={CONTROL.rail} onDark>
          <div className="mb-3">
            <SectionHeading onDark>{CONTROL.heading}</SectionHeading>
          </div>
          <p className="m-0 mb-10 max-w-[560px] text-[15px] leading-[1.6] text-[var(--besu-grey)]">
            {CONTROL.deck}
          </p>
          <div className="flex flex-col">
            {CONTROL.rows.map((row, i) => (
              <div
                key={row.lead}
                className={`grid grid-cols-[44px_1fr] gap-6 border-t border-[var(--besu-row-rule)] py-5 ${
                  i === CONTROL.rows.length - 1
                    ? "border-b border-b-[var(--besu-row-rule)]"
                    : ""
                }`}
              >
                <div
                  className={`${FONT_MONO} text-[11px] font-medium text-[var(--besu-red)]`}
                >
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="max-w-[760px]">
                  <span className="text-[15px] font-semibold text-white">
                    {row.lead}
                  </span>{" "}
                  <span className="text-[15px] leading-[1.65] text-[var(--besu-grey)]">
                    {row.rest}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </RailHeading>
      </div>
    </section>
  );
}

/* ---------------- 7. What remains visible ---------------- */

export function Visibility() {
  return (
    <section className={`${BESU_CONTAINER} pt-[90px]`}>
      <RailHeading rail={railLines(VISIBILITY.rail)}>
        <div className="mb-7">
          <SectionHeading>{VISIBILITY.heading}</SectionHeading>
        </div>
        <div className="grid grid-cols-1 gap-px border border-[var(--besu-hairline)] bg-[var(--besu-hairline)] sm:grid-cols-2 lg:grid-cols-3">
          {VISIBILITY.cells.map((cell) => (
            <div
              key={cell.eyebrow}
              className={`px-6 py-7 ${
                cell.inverted ? "bg-[var(--besu-ink)]" : "bg-white"
              }`}
            >
              <div
                className={`${FONT_MONO} mb-[14px] text-[10px] font-medium tracking-[0.12em] ${
                  cell.inverted
                    ? "text-[var(--besu-red-bright)]"
                    : "text-[var(--besu-slate)]"
                }`}
              >
                {cell.eyebrow}
              </div>
              <div
                className={`text-[14px] leading-[1.65] ${
                  cell.inverted
                    ? "text-[var(--besu-grey)]"
                    : "text-[var(--besu-ink)]"
                }`}
              >
                {cell.body}
              </div>
            </div>
          ))}
        </div>
      </RailHeading>
    </section>
  );
}

/* ---------------- 8. Alternatives ---------------- */

export function Alternatives() {
  return (
    <section
      id="alternatives"
      className={`${BESU_SCROLL_OFFSET} ${BESU_CONTAINER} pt-[90px]`}
    >
      <RailHeading rail={railLines(ALTERNATIVES.rail)}>
        <div className="mb-3">
          <SectionHeading>{ALTERNATIVES.heading}</SectionHeading>
        </div>
        <p className="m-0 mb-[34px] max-w-[600px] text-[15px] leading-[1.6] text-[var(--besu-slate)]">
          {ALTERNATIVES.deck}
        </p>

        {/* Scrolls rather than crushing on narrow viewports. */}
        <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[1.1fr_1fr_1fr_1fr_1.15fr] text-[13px] leading-[1.55] text-[var(--besu-ink)]">
              <div
                className={`${FONT_MONO} col-span-full grid grid-cols-subgrid border-b-2 border-[var(--besu-ink)] pb-[14px] text-[10px] font-medium tracking-[0.1em] text-[var(--besu-slate)]`}
              >
                <div />
                {ALTERNATIVES.columns.map((col, i) => (
                  <div
                    key={col}
                    className={`pl-4 ${
                      i === ALTERNATIVES.columns.length - 1
                        ? "text-[var(--besu-red-dark)]"
                        : ""
                    }`}
                  >
                    {col}
                  </div>
                ))}
              </div>

              {ALTERNATIVES.rows.map((row, i) => (
                <div
                  key={row.label}
                  className={`col-span-full grid grid-cols-subgrid py-4 ${
                    i === ALTERNATIVES.rows.length - 1
                      ? "border-b-2 border-[var(--besu-ink)]"
                      : "border-b border-[var(--besu-hairline-table)]"
                  } ${
                    "highlight" in row && row.highlight
                      ? "bg-[var(--besu-highlight)]"
                      : ""
                  }`}
                >
                  <div className="pr-4 font-medium text-black">{row.label}</div>
                  {row.cells.map((cell, j) => (
                    <div key={j} className="px-4 text-[var(--besu-slate)]">
                      {cell}
                    </div>
                  ))}
                  <div className="px-4">
                    {"oursBold" in row && row.oursBold ? (
                      <>
                        <b className="font-semibold">{row.oursBold}</b>
                        {row.ours}
                      </>
                    ) : (
                      row.ours
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* The concession comes first and carries the same type weight as the
            pull note, on a neutral rule rather than the red one, so it reads
            as a peer rather than a footnote. Order is the argument: here is
            where they win, and here is why the trade is still right. */}
        <div className="mt-5 max-w-[760px] border-l-[3px] border-[var(--besu-slate)] pl-4 text-[14px] leading-[1.7] text-[var(--besu-slate)] [text-wrap:pretty]">
          {ALTERNATIVES.concession}
        </div>

        <div className="mt-4 max-w-[760px] border-l-[3px] border-[var(--besu-red)] pl-4 text-[14px] leading-[1.7] text-[var(--besu-slate)] [text-wrap:pretty]">
          {ALTERNATIVES.pullNote}
        </div>
      </RailHeading>
    </section>
  );
}

/* ---------------- 9. CTA (dark) ---------------- */

export function Cta() {
  return (
    <section
      id="next"
      className={`${BESU_SCROLL_OFFSET} relative mt-[90px] overflow-hidden bg-[var(--besu-ink)]`}
    >
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-[240px]">
        <Image
          src={BESU_ASSETS.ctaTexture}
          alt=""
          fill
          sizes="100vw"
          className="object-cover object-bottom opacity-50 mix-blend-screen"
        />
      </div>
      <div className={`${BESU_CONTAINER} relative pb-[150px] pt-[100px]`}>
        <div className="mb-[30px] h-0.5 w-[70px] bg-[var(--besu-red)]" />
        <h2
          className={`${FONT_DISPLAY} m-0 max-w-[820px] text-[clamp(34px,7vw,52px)] font-black uppercase leading-[0.98] tracking-[-0.03em] text-white [text-wrap:balance]`}
        >
          {CTA.headingLines.map((line, i) => (
            <span key={line}>
              {line}
              {i < CTA.headingLines.length - 1 ? <br /> : null}
            </span>
          ))}
          <span className="text-[var(--besu-red)]">.</span>
        </h2>
        <p className="mb-10 mt-7 max-w-[520px] text-[17px] leading-[1.55] text-[var(--besu-grey)]">
          {CTA.deck}
        </p>
        <ButtonRow primary={CTA.primaryCta} secondary={CTA.secondaryCta} />
      </div>
    </section>
  );
}

/* ---------------- 10. Footer ---------------- */

export function PageFooter() {
  return (
    <footer className="border-t border-[var(--besu-hairline-dark)] bg-[var(--besu-ink)]">
      <div
        className={`${BESU_CONTAINER} ${FONT_MONO} flex flex-col gap-2 py-[26px] text-[10px] font-medium tracking-[0.14em] text-[var(--besu-grey)] sm:flex-row sm:items-center sm:justify-between`}
      >
        <span>{FOOTER.left}</span>
        <span>{FOOTER.right}</span>
      </div>
    </footer>
  );
}
