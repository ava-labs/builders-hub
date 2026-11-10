/**
 * Curated "Built on Avalanche" roster for the homepage tape.
 *
 * Two tiers: public institutional pilots/deployments (banks, asset
 * managers, and US state/county governments) and flagship brand
 * deployments. Deloitte was dropped 2026-07: no live first-party source
 * survives for the 2021 FEMA platform.
 *
 * Logos: each `image` is a square, transparent mark in
 * /public/logos/partners/tape, taken from the brand's own site (header
 * SVG, app icon or favicon). The mark is centered and scaled so its
 * farthest point sits 38% of the width from the center, and `chip` is the
 * background of the round tile behind it (the brand's icon tile or site
 * color). That is the one fit rule the tape applies to every logo.
 *
 * NOTE: before production, comms/legal must sign off on displaying bank
 * marks (a pilot is not an endorsement) and assets should move to
 * Contentful.
 */
export interface BuiltOnChain {
  name: string;
  image: string;
  chip: string; // CSS background of the round chip
  link: string;
}

export const BUILT_ON_CHAINS: BuiltOnChain[] = [
  // Institutional pilots & deployments. Every link is a verified FIRST-HAND
  // proof source that explicitly names Avalanche — the institution's own
  // release, the direct issuing partner's release, or avax.network's own
  // announcement. Never a homepage, press only if nothing first-hand
  // exists (currently: none). Researched and link-checked 2026-07.
  // avax first-hand post: Onyx portfolio-management PoC on an Evergreen subnet (2023-11)
  { name: "JPMorgan", image: "/logos/partners/tape/jpmorgan.png", chip: "#242526", link: "https://www.avax.network/about/blog/onyx-j-p-morgan-leverages-avalanche-for-portfolio-management" },
  // Citi's own release: Wellington PE fund tokenized on Avalanche Spruce (2024-02)
  { name: "Citi", image: "/logos/partners/tape/citi.svg", chip: "#ffffff", link: "https://www.citigroup.com/global/news/press-release/2024/citi-collaborates-with-wellington-management-and-wisdomtree-to-explore-tokenization-of-private-markets" },
  // Securitize release via PRNewswire: BUIDL share class on Avalanche (2024-11)
  { name: "BlackRock", image: "/logos/partners/tape/blackrock.svg", chip: "#000000", link: "https://www.prnewswire.com/news-releases/blackrock-launches-new-buidl-share-classes-across-multiple-blockchains-to-expand-access-and-potential-of-buidl-ecosystem-302304035.html" },
  // avax first-hand post: BENJI money market fund extends to Avalanche (2024-08)
  { name: "Franklin Templeton", image: "/logos/partners/tape/franklin-templeton.png", chip: "#00081f", link: "https://www.avax.network/about/blog/franklin-templeton-launches-tokenized-money-market-fund-benji-avalanche" },
  // Apollo × Securitize ACRED tokenized credit fund, Avalanche a launch chain (2025-01)
  { name: "Apollo", image: "/logos/partners/tape/apollo.png", chip: "#ffffff", link: "https://securitize.io/learn/press/apollo-and-securitize-announce-partnership-and-launch-tokenized-access-to-credit-fund" },
  // WisdomTree's own IR release: Connect tokenized funds on Avalanche (2025-04)
  { name: "WisdomTree", image: "/logos/partners/tape/wisdomtree.svg", chip: "#ffffff", link: "https://ir.wisdomtree.com/news-events/press-releases/detail/725/wisdomtree-connect-now-offers-13-tokenized-funds-across" },
  // founding participant of the Spruce Evergreen subnet (2023-04)
  { name: "T. Rowe Price", image: "/logos/partners/tape/t-rowe-price.png", chip: "#00cfec", link: "https://www.avax.network/about/blog/financial-institutions-join-avalanche-evergreen-subnet-spruce-to-drive-on-chain-finance-innovation" },
  // avax first-hand post: Citi+Wellington PE-fund tokenization on Spruce (2024-02).
  // Citi's own release also names Avalanche Spruce but bot-blocks link checkers.
  { name: "Wellington Management", image: "/logos/partners/tape/wellington.svg", chip: "linear-gradient(#123361 50%, #00bae8 50%)", link: "https://www.avax.network/about/blog/citi-tests-benefits-of-private-markets-tokenization-with-avalanche-evergreen-subnet-spruce" },
  // avax first-hand post: Grove deploys $250M into Janus tokenized funds (2025-07)
  { name: "Janus Henderson", image: "/logos/partners/tape/janus-henderson.png", chip: "#252a36", link: "https://www.avax.network/about/blog/grove-finance-launches-on-avalanche-with-usd250m-target-investment" },
  // same first-hand post from the allocator's side: Grove (Sky ecosystem)
  // targets $250M of RWA deployment on Avalanche (2025-07)
  { name: "Grove", image: "/logos/partners/tape/grove.png", chip: "#101010", link: "https://www.avax.network/about/blog/grove-finance-launches-on-avalanche-with-usd250m-target-investment" },
  // avax first-hand post: Republic Note security token on Avalanche (2023-11)
  { name: "Republic", image: "/logos/partners/tape/republic.svg", chip: "#ffffff", link: "https://www.avax.network/about/blog/republic-selects-avalanche-for-its-profit-sharing-digital-asset" },
  // avax first-hand post: 42M vehicle titles digitized on Avalanche (2024-07)
  { name: "California DMV", image: "/logos/partners/tape/california-dmv.png", chip: "#ffffff", link: "https://www.avax.network/about/blog/california-dmv-makes-history-digitizes-42-million-car-titles-on-avalanche-blockchain" },
  // avax first-hand post: FRNT, the first US state-issued stablecoin, by the
  // Wyoming Stable Token Commission, live on Avalanche (2026-01)
  { name: "Wyoming FRNT", image: "/logos/partners/tape/wyoming-frnt.png", chip: "#ffffff", link: "https://www.avax.network/about/blog/frnt-goes-live-the-first-u-s-state-issued-stablecoin-you-can-actually-use" },
  // avax first-hand post: Bergen County NJ puts $240B / 370k property deeds
  // on a purpose-built Avalanche L1 with Balcony (2025-05)
  { name: "Balcony", image: "/logos/partners/tape/balcony.png", chip: "#ff5454", link: "https://www.avax.network/about/blog/240b-in-real-estate-is-coming-on-chain-with-balcony-and-avalanche" },
  // Securitize's own release: tokenizing BUIDL onto Avalanche (2024-11)
  { name: "Securitize", image: "/logos/partners/tape/securitize.svg", chip: "#ffffff", link: "https://securitize.io/learn/press/blackRock-launches-new-buidl-share-classes-across-multiple-blockchains" },
  // avax first-hand post: IntainMARKETS ABS marketplace as an Avalanche L1 (2023-01)
  { name: "Intain", image: "/logos/partners/tape/intain.png", chip: "#ffffff", link: "https://www.avax.network/about/blog/intain-launches-avalanche-subnet-to-usher-in-new-era-for-multi-trillion-dollar-securitized-finance-market" },
  // Dinari's own blog: Dinari Financial Network L1 on Avalanche (2025-08)
  { name: "Dinari", image: "/logos/partners/tape/dinari.png", chip: "#07846d", link: "https://dinari.com/blog/dinari-launches-the-dinari-financial-network-an-omni-chain-orderbook-powered-by-avalanche" },
  // StraitsX's own blog: XSGD issued on the Avalanche C-Chain (2024-06)
  { name: "StraitsX", image: "/logos/partners/tape/straitsx.png", chip: "#ffffff", link: "https://www.straitsx.com/blog-post/xsgd-supported-on-avalanche" },

  // Flagship brand deployments
  { name: "Kite AI", image: "/logos/partners/tape/kite-ai.svg", chip: "#fef8f0", link: "https://gokite.ai" },
  { name: "FIFA", image: "/logos/partners/tape/fifa.png", chip: "#326295", link: "https://collect.fifa.com/" },
  { name: "MapleStory", image: "/logos/partners/tape/maplestory.png", chip: "#ffffff", link: "https://maplestoryuniverse.com/" },
  { name: "Gunzilla", image: "/logos/partners/tape/gunzilla.png", chip: "#030102", link: "https://gunzillagames.com/" },
  { name: "Dexalot", image: "/logos/partners/tape/dexalot.png", chip: "#ffffff", link: "https://dexalot.com/" },
  { name: "UPTN", image: "/logos/partners/tape/uptn.png", chip: "#5f46ff", link: "https://uptn.io/" },
  { name: "Lamina1", image: "/logos/partners/tape/lamina1.png", chip: "#000000", link: "https://lamina1.com/" },
];
