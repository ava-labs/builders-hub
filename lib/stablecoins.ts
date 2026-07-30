/* The stablecoin facet's curated layer. DefiLlama carries the numbers
   (circulating supply, prices, history); this file carries what no feed
   provides: who issues each token, the jurisdiction it answers to, and
   the verified C-Chain contract that links a row into the explorer.
   Every address below was verified on-chain via symbol() before landing
   here: add new entries the same way, never from memory. */

export interface StablecoinAsset {
  /** DefiLlama pegged-asset id, the stable join key */
  id: string;
  name: string;
  symbol: string;
  /** ISO currency the token tracks: USD, EUR, JPY, ... */
  pegCurrency: string;
  /** fiat-backed | crypto-backed | algorithmic */
  mechanism: string;
  /** USD price per token; null when DefiLlama has no feed */
  price: number | null;
  /** circulating value on Avalanche, USD */
  mcap: number;
  /** circulating value 24h / 7d / 30d ago, USD */
  prevDay: number | null;
  prevWeek: number | null;
  prevMonth: number | null;
  issuer?: string;
  issuerUrl?: string;
  /** issuer jurisdiction (the ungrouped table view) */
  country?: string;
  flag?: string;
  /** verified C-Chain contract, when we have one */
  address?: string;
  /** DefiLlama's pegged-asset icon CDN */
  logo?: string;
}

export interface StablecoinHistoryPoint {
  /** unix seconds, one point per day */
  date: number;
  /** total circulating value on Avalanche, USD */
  total: number;
  /** issued on Avalanche vs bridged in, USD */
  minted: number;
  bridged: number;
  /** per-currency USD split: { USD: ..., EUR: ..., JPY: ... } */
  byCurrency: Record<string, number>;
}

/* the market-cap chart's stacked bands: the top coins by current value,
   everything else folded into "other" against the aggregate total */
export interface StablecoinStackKey {
  id: string;
  symbol: string;
  logo?: string;
}

export interface StablecoinStackPoint {
  /** unix seconds, one point per day */
  date: number;
  /** USD circulating per stack key id */
  coins: Record<string, number>;
  other: number;
  total: number;
}

export interface StablecoinsApiResponse {
  assets: StablecoinAsset[];
  history: StablecoinHistoryPoint[];
  stack: {
    keys: StablecoinStackKey[];
    points: StablecoinStackPoint[];
  };
  updatedAt: number;
}

/* Each peg currency's anchor: the country the currency itself belongs to.
   The grouped table view (Group EU on) keys rows off this; the ungrouped
   view prefers the issuer's own jurisdiction from STABLECOIN_META. */
export const CURRENCY_INFO: Record<
  string,
  { code: string; country: string; flag: string }
> = {
  peggedUSD: { code: "USD", country: "United States", flag: "\u{1F1FA}\u{1F1F8}" },
  peggedEUR: { code: "EUR", country: "Europe", flag: "\u{1F1EA}\u{1F1FA}" },
  peggedJPY: { code: "JPY", country: "Japan", flag: "\u{1F1EF}\u{1F1F5}" },
  peggedCHF: { code: "CHF", country: "Switzerland", flag: "\u{1F1E8}\u{1F1ED}" },
  peggedSGD: { code: "SGD", country: "Singapore", flag: "\u{1F1F8}\u{1F1EC}" },
  peggedTRY: { code: "TRY", country: "Turkey", flag: "\u{1F1F9}\u{1F1F7}" },
  peggedGBP: { code: "GBP", country: "United Kingdom", flag: "\u{1F1EC}\u{1F1E7}" },
  peggedAUD: { code: "AUD", country: "Australia", flag: "\u{1F1E6}\u{1F1FA}" },
  peggedBRL: { code: "BRL", country: "Brazil", flag: "\u{1F1E7}\u{1F1F7}" },
  peggedMXN: { code: "MXN", country: "Mexico", flag: "\u{1F1F2}\u{1F1FD}" },
};

interface StablecoinMeta {
  issuer?: string;
  issuerUrl?: string;
  /** issuer jurisdiction, only where it differs from the currency anchor
      or the anchor is a region (EUR): shown when Group EU is off */
  country?: string;
  flag?: string;
  /** verified C-Chain contract (symbol() checked on mainnet) */
  address?: string;
}

/* Keyed by DefiLlama pegged-asset id: symbols collide (two BUSDs), ids
   don't. Unlisted assets fall back to the currency anchor with no issuer
   link, which renders as a quiet em-dash cell, never a guess. */
export const STABLECOIN_META: Record<string, StablecoinMeta> = {
  // ---- USD ----
  "1": {
    issuer: "Tether",
    issuerUrl: "https://tether.to",
    country: "El Salvador",
    flag: "\u{1F1F8}\u{1F1FB}",
    address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
  },
  "2": {
    issuer: "Circle",
    issuerUrl: "https://www.circle.com",
    address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
  },
  "173": {
    issuer: "BlackRock / Securitize",
    issuerUrl: "https://securitize.io",
    address: "0x53fC82f14F009009b440A706e31c9021E1196A2F",
  },
  "271": {
    issuer: "Avant",
    issuerUrl: "https://www.avantprotocol.com",
  },
  "305": {
    issuer: "XSY",
    issuerUrl: "https://xsy.fi",
  },
  "205": {
    issuer: "Agora",
    issuerUrl: "https://www.agora.finance",
    address: "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a",
  },
  "5": {
    issuer: "Sky (MakerDAO)",
    issuerUrl: "https://sky.money",
    address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70",
  },
  "7": {
    issuer: "TrueUSD",
    issuerUrl: "https://tusd.io",
    address: "0x1C20E891Bab6b1727d14Da358FAe2984Ed9B59EB",
  },
  "146": {
    issuer: "Ethena",
    issuerUrl: "https://ethena.fi",
    address: "0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34",
  },
  "6": {
    issuer: "Frax",
    issuerUrl: "https://frax.finance",
    address: "0xD24C2Ad096400B6FBcd2ad8B24E7acBc21A1da64",
  },
  "235": {
    issuer: "Frax",
    issuerUrl: "https://frax.finance",
  },
  "10": {
    issuer: "Abracadabra",
    issuerUrl: "https://abracadabra.money",
    address: "0x130966628846BFd36ff31a822705796e8cb8C18D",
  },
  "4": {
    issuer: "Paxos / Binance",
    issuerUrl: "https://paxos.com",
  },
  "153": {
    issuer: "Binance (bridged)",
    address: "0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39",
  },
  // ---- EUR ----
  "50": {
    issuer: "Circle",
    issuerUrl: "https://www.circle.com",
    country: "France",
    flag: "\u{1F1EB}\u{1F1F7}",
    address: "0xC891EB4cbdEFf6e073e859e987815Ed1505c2ACD",
  },
  "247": {
    issuer: "Schuman Financial",
    issuerUrl: "https://www.schuman.io",
    country: "France",
    flag: "\u{1F1EB}\u{1F1F7}",
  },
  "158": {
    issuer: "VNX",
    issuerUrl: "https://vnx.li",
    country: "Liechtenstein",
    flag: "\u{1F1F1}\u{1F1EE}",
  },
  // ---- CHF ----
  "157": {
    issuer: "VNX",
    issuerUrl: "https://vnx.li",
    country: "Liechtenstein",
    flag: "\u{1F1F1}\u{1F1EE}",
  },
  // ---- JPY ----
  "355": {
    issuer: "JPYC Inc.",
    issuerUrl: "https://jpyc.jp",
    address: "0x431D5dfF03120AFA4bDf332c61A6e1766eF37BDB",
  },
  // ---- SGD ----
  "289": {
    issuer: "StraitsX",
    issuerUrl: "https://www.straitsx.com",
  },
  // ---- TRY ----
  "300": {
    issuer: "BiLira",
    issuerUrl: "https://www.bilira.co",
    address: "0x564A341Df6C126f90cf3ECB92120FD7190ACb401",
  },
};
