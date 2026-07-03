// Digital Asset Treasury (DAT) and ETF metadata for the AVAX token stats page.
// Mirrors the dataset from joeycannoliLABS/avax-DAT-ETF-dashboard. The live
// /api/avax-dat-etf route overlays current fields from reliable public sources
// where available; static fields (description, highlights, links) stay as-is.

/** Shared shape for the logo asset configuration. */
interface LogoConfig {
  /** Path under /public — used in light mode (and dark mode if no dark variant). */
  logoSrc: string;
  /** Optional dark-mode variant. If absent, the component falls back to logoTone. */
  logoSrcDark?: string;
  /** Source tone of `logoSrc` — drives auto-inversion when no explicit dark variant exists:
   * - "light": logo is white-on-transparent → CSS-inverted in LIGHT mode so it shows on white cards
   * - "dark":  logo is black/dark-on-transparent → CSS-inverted in DARK mode so it shows on dark cards
   * - "color": multi-color logo readable on both modes — no inversion applied
   */
  logoTone?: 'light' | 'dark' | 'color';
}

export interface DatEntry extends LogoConfig {
  id: string;
  name: string;
  ticker: string;
  exchange: string;
  /** Baseline AVAX held in treasury. Overridden by live data when available. */
  avaxHoldings: number;
  /** Optional baseline assets under management in USD. */
  aum?: number;
  status: string;
  description: string;
  highlights: string[];
  color: string;
  xUrl?: string;
  webUrl?: string;
}

export interface EtfEntry extends LogoConfig {
  id: string;
  name: string;
  ticker: string;
  sponsor: string;
  exchange: string;
  /** Baseline AUM in USD. Overridden by live data when available. */
  aum: number;
  /** Baseline AVAX held by the ETF. Overridden by live data when available. */
  avaxHoldings: number;
  /** Headline sponsor fee. 0 means waived. */
  sponsorFee: number;
  /** Fee that applies after any current waiver expires. */
  sponsorFeeAfterWaiver?: number;
  /** Last date, inclusive, for a current fee waiver. */
  sponsorFeeWaiverEnd?: string;
  /** Pct of AVAX currently staked (informational). */
  stakingPct?: number;
  navPerShare?: number;
  /** Max pct of AVAX the fund is allowed to stake. */
  stakingMax?: number;
  status: string;
  description: string;
  highlights: string[];
  color: string;
  /** Marketing or buy link. */
  buyUrl?: string;
}

export interface HistoryPoint {
  date: string;
  avax: number;
  label?: string;
}

export const DATS: DatEntry[] = [
  {
    id: 'avax-one',
    name: 'AVAX One',
    ticker: 'AVX',
    exchange: 'NASDAQ',
    avaxHoldings: 13_800_000,
    status: 'Live',
    description:
      "AVAX One offers investors regulated access to Avalanche, one of the fastest-growing Layer 1 blockchain ecosystems. Combining the reliability of U.S. equity markets with the upside of next-gen finance, it's a modern strategy for a new financial era.",
    highlights: [
      'Acquired 9.37M AVAX for $110M (Nov 2025)',
      '$40M share buyback authorized',
      '~$600K staking rewards earned through Dec 2025',
      'Expects ~180K AVAX staking rewards in Q1 2026',
      'Treasury analytics dashboard at avax-one.com',
    ],
    color: '#E84142',
    // AVAX One ships proper variants on their site — full-color for light backgrounds, REV for dark.
    logoSrc: '/dat-etf/avaxone-light.png',
    logoSrcDark: '/dat-etf/avaxone-dark.png',
    xUrl: 'https://x.com/avax_one',
    webUrl: 'https://avax-one.com',
  },
  {
    id: 'avat-treasury',
    name: 'Avalanche Treasury Co.',
    ticker: 'AVAT',
    exchange: "NASDAQ (Q1 '26)",
    avaxHoldings: 9_280_000,
    aum: 460_000_000,
    status: 'Live',
    description:
      "The premiere way to get regulated AVAX exposure. We're the institutional growth engine for the Avalanche ecosystem, with an exclusive relationship with Avalanche itself. Funding builders. Accelerating technologies. Bringing institutions to AVAX.",
    highlights: [
      '$675M business combination with MLAC (Nasdaq)',
      '~25M AVAX acquired via $200M discounted purchase from Avalanche Foundation',
      'Purchased at 0.77x mNAV (23% discount to market)',
      '18-month priority on Avalanche Foundation sales to US DATs',
      '$460M in treasury assets at closing',
      'Target: $1B+ in AVAX holdings post-listing',
    ],
    color: '#F59E0B',
    // AVAT's official SVG — red+dark mark, readable on both modes.
    logoSrc: '/dat-etf/avat.svg',
    logoTone: 'color',
    xUrl: 'https://x.com/avat_co',
    webUrl: 'https://avat.com/',
  },
  {
    id: 'deft',
    name: 'DeFi Technologies',
    ticker: 'DEFT',
    exchange: 'NASDAQ',
    avaxHoldings: 398_321,
    status: 'Live',
    description:
      'Fintech company bridging traditional capital markets with DeFi. Operates Valour (102 ETPs), Stillman execution desk, and holds a multi-asset digital treasury including AVAX.',
    highlights: [
      '398,321 AVAX held in treasury (~$7.3M at current prices)',
      '102 ETPs listed globally via Valour subsidiary',
      '$165.7M in cash + digital asset treasury (as of Q3 2025)',
      '$138.2M net inflows in 2025 (record year)',
      '~$80M revenue and $39M operating income through Q3 2025',
      'Zero debt; $44M in venture investments',
    ],
    color: '#10B981',
    logoSrc: '/dat-etf/defitechlogo.png',
    logoTone: 'dark',
    xUrl: 'https://x.com/DeFiTechGlobal',
    webUrl: 'https://defi.tech',
  },
];

export const ETFS: EtfEntry[] = [
  {
    id: 'vaneck-vavx',
    name: 'VanEck Avalanche ETF',
    ticker: 'VAVX',
    sponsor: 'VanEck',
    exchange: 'NASDAQ',
    aum: 13_970_000,
    avaxHoldings: 1_722_595,
    sponsorFee: 0.2,
    stakingPct: 85,
    navPerShare: 16.93,
    stakingMax: 85,
    status: 'Live',
    description:
      'U.S.-listed AVAX spot ETF. Incepted December 22, 2025. Holds AVAX directly and is designed to earn potential staking rewards.',
    highlights: [
      '1.72M AVAX held as of Jun 3, 2026',
      '$13.97M total net assets as of Jun 3, 2026',
      '85% of AVAX staked',
      'Sponsor fee: 0.20%',
      'Listed on NASDAQ',
    ],
    color: '#E84142',
    logoSrc: '/dat-etf/vaneck.png',
    logoTone: 'dark',
    buyUrl: 'https://www.vaneck.com/',
  },
  {
    id: 'grayscale-gava',
    name: 'Grayscale Avalanche Staking ETF',
    ticker: 'GAVA',
    sponsor: 'Grayscale',
    exchange: 'NASDAQ',
    aum: 5_309_116,
    avaxHoldings: 597_201,
    sponsorFee: 0,
    sponsorFeeAfterWaiver: 0.35,
    sponsorFeeWaiverEnd: '2026-06-12',
    navPerShare: 21.41,
    stakingMax: 85,
    status: 'Live',
    description:
      'Converted from Grayscale Avalanche Trust to a spot staking ETF. Launched March 13, 2026 on NASDAQ. Allows staking up to 85% of AVAX holdings for yield generation.',
    highlights: [
      'Launched Mar 13, 2026 on NASDAQ (converted from trust)',
      '597,201 AVAX held at Mar 31, 2026 quarter-end',
      '$5.3M principal market NAV at Mar 31, 2026',
      'Sponsor fee waived through Jun 12, 2026, then 0.35%',
      'Coinbase Custody + BNY Mellon admin',
      'Originally launched Aug 2024 as private trust (ticker AVAXFUN)',
    ],
    color: '#737373',
    logoSrc: '/dat-etf/grayscale.png',
    logoTone: 'light',
    buyUrl: 'https://www.grayscale.com/funds/grayscale-avalanche-trust',
  },
  {
    id: 'bitwise-bava',
    name: 'Bitwise Avalanche ETF',
    ticker: 'BAVA',
    sponsor: 'Bitwise',
    exchange: 'NYSE Arca',
    aum: 20_323_777,
    avaxHoldings: 2_505_863,
    sponsorFee: 0.34,
    stakingPct: 68.49,
    navPerShare: 21.85,
    stakingMax: 70,
    status: 'Live',
    description:
      'U.S.-listed AVAX ETP from Bitwise. Launched April 14, 2026 and targets staking up to 70% of fund assets.',
    highlights: [
      'Lowest fee at 0.34% among AVAX ETFs',
      '2.51M AVAX held as of Jun 3, 2026',
      '$20.32M net assets as of Jun 3, 2026',
      '68.5% currently staked; target 70%',
      'Coinbase Custody + BNY Mellon',
    ],
    color: '#3B82F6',
    logoSrc: '/dat-etf/bitwise.png',
    logoTone: 'light',
    buyUrl: 'https://bavaetf.com/',
  },
];

export const DAT_HISTORY: HistoryPoint[] = [
  { date: 'Sep 2025', avax: 0, label: 'AVAX One announces DAT strategy' },
  { date: 'Oct 2025', avax: 4_400_000, label: 'AVAX One initial purchases + AVAT $200M buy' },
  { date: 'Nov 2025', avax: 23_478_321, label: 'AVAX One adds 9.37M + DEFT 398K' },
  { date: 'Dec 2025', avax: 23_478_321, label: 'Holdings steady, staking rewards accrue' },
  { date: 'Jan 2026', avax: 23_564_321, label: 'AVAX One staking rewards added' },
  { date: 'Feb 2026', avax: 23_564_321, label: 'Holdings steady' },
  { date: 'Mar 2026', avax: 23_598_321, label: 'Holdings steady' },
  { date: 'Apr 2026', avax: 23_598_321, label: 'Holdings steady' },
  { date: 'May 2026', avax: 23_598_321, label: 'Current holdings' },
];

export const ETF_HISTORY: HistoryPoint[] = [
  { date: 'Jan 2026', avax: 490_000, label: 'VAVX launches as first U.S. AVAX spot ETF' },
  { date: 'Feb 2026', avax: 820_000, label: 'VAVX inflows grow, GAVA and BAVA file' },
  { date: 'Mar 2026', avax: 1_250_000, label: 'GAVA and BAVA launch' },
  { date: 'Apr 2026', avax: 3_200_000, label: 'Rapid inflows across all three ETFs' },
  { date: 'May 2026', avax: 4_842_233, label: 'ETF holdings expand across VAVX, GAVA, and BAVA' },
  { date: 'Jun 2026', avax: 4_825_659, label: 'Current combined ETF holdings' },
];
