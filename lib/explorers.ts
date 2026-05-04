// Explorer URL constructors for an L1. When the L1 already has a configured
// explorer URL, returns up to four options the user can pick between in the
// dashboard's "Open Explorer" dropdown — modeled on the 3-way picker added
// to the dApps page in PR #4093, plus the Builder Hub native explorer.
// When no explorer is configured for a non-C-Chain L1 with no EVM chain ID
// to anchor a Builder Hub URL, return no options so ExplorerMenu can surface
// the "Setup Explorer" action.
//
//   0. Firn Explorer — surfaced first whenever the L1 carries a
//      `*.firn.gg` URL (every managed L1 does, set by
//      `lib/console/my-l1s.ts`). It's the default for Quick L1 deploys
//      because the firn indexer is the only explorer that knows about a
//      brand-new managed L1 the moment it boots.
//
//   1. Builder Hub Explorer — the in-app `/explorer/{slug}` route. Falls
//      to second when Firn is present, otherwise top of the list because
//      it's our own product, opens in the same tab, and works for any
//      chain the user has provisioned (matches by EVM chain ID against
//      the wallet's L1ListItem).
//
//   2. Avalanche Subnets — the official Avalanche-team explorer at
//      subnets[-test].avax.network. For L1s where the wallet's
//      L1ListItem.explorerUrl already points at this domain we surface it
//      directly (deep link). Otherwise we fall back to the network home,
//      since the per-L1 slug varies and isn't reliably derivable from
//      `l1-chains.json` (wallet uses `echo`, l1-chains uses `echo-l1`).
//
//   3. Snowtrace — Routescan-powered, Etherscan-style explorer. Native
//      surface area for C-Chain (snowtrace.io / testnet.snowtrace.io).
//      For non-C-Chain L1s the trigger lands on the testnet/mainnet home
//      so the user can search.
//
//   4. Either L1 Custom Explorer (when the wallet has a non-Subnets,
//      non-Firn explorerUrl set — e.g. a project's bespoke explorer like
//      explorer.dexalot.com) OR Avascan for C-Chain/Subnets-backed entries.
//      Avascan supports L1s and tx/address search across the entire
//      ecosystem at avascan.info / testnet.avascan.info.

const C_CHAIN_FUJI = 43113;
const C_CHAIN_MAINNET = 43114;

export interface ExplorerOption {
  id: 'firn' | 'builder-hub' | 'subnets' | 'snowtrace' | 'custom' | 'avascan';
  label: string;
  url: string;
  /** Short description for tooltip / menu subtitle. */
  description: string;
  /** True when the URL is an in-app route (open in the same tab). External
   *  third-party explorers default to false → new tab. */
  internal?: boolean;
}

interface ExplorerInputs {
  evmChainId: number | null;
  isTestnet: boolean;
  /** L1's user-set explorer URL from wallet's L1ListItem (optional). */
  customExplorerUrl?: string;
}

const SUBNETS_HOST_TESTNET = 'subnets-test.avax.network';
const SUBNETS_HOST_MAINNET = 'subnets.avax.network';
// Firn-served per-L1 explorers live at `<8-char-slug>.firn.gg`. Detect the
// host suffix rather than a full hostname so future tld variants (staging,
// subdomains) still resolve. URL-parse with a try/catch — `customExplorerUrl`
// can be free-text from older wallet entries.
const FIRN_HOST_SUFFIX = '.firn.gg';

function isSubnetsUrl(url: string): boolean {
  return url.includes(SUBNETS_HOST_TESTNET) || url.includes(SUBNETS_HOST_MAINNET);
}

function isFirnUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(FIRN_HOST_SUFFIX);
  } catch {
    return false;
  }
}

// Map an EVM chain ID to its Builder Hub explorer slug. C-Chain has
// canonical slugs in `l1-chains.json` (`c-chain`, `avalanche-c-chain`); for
// every other L1 the slug fallback is the numeric EVM chain ID, which the
// `[chainSlug]/layout.client.tsx` resolver matches against
// `String(item.evmChainId)` in the wallet's L1ListItem.
function builderHubExplorerSlug(evmChainId: number): string {
  if (evmChainId === C_CHAIN_FUJI) return 'avalanche-c-chain';
  if (evmChainId === C_CHAIN_MAINNET) return 'c-chain';
  return String(evmChainId);
}

export function getExplorerOptions(input: ExplorerInputs): ExplorerOption[] {
  const { evmChainId, isTestnet, customExplorerUrl } = input;
  const isCChain = evmChainId === C_CHAIN_FUJI || evmChainId === C_CHAIN_MAINNET;
  const customPointsAtSubnets = !!customExplorerUrl && isSubnetsUrl(customExplorerUrl);
  const customPointsAtFirn = !!customExplorerUrl && isFirnUrl(customExplorerUrl);

  // Surface third-party explorers only when they actually point at the
  // user's L1: C-Chain (universally indexed) or a wallet-configured
  // explorer URL. For a custom L1 with no configured explorer, the
  // network-home fallbacks (snowtrace.io, subnets.avax.network) just dump
  // the user on a generic search page, which is worse UX than not
  // surfacing them at all — Builder Hub Explorer alone handles the case.
  const showThirdParty = isCChain || !!customExplorerUrl;

  // No options at all when we can't anchor *any* surface — wallet-only L1
  // with no EVM chain ID and no configured explorer. ExplorerMenu falls
  // through to the "Setup Explorer" CTA in that case.
  if (evmChainId === null && !showThirdParty) {
    return [];
  }

  const options: ExplorerOption[] = [];

  // 0. Firn Explorer — top option when the wallet's explorer URL points
  // at firn.gg. Quick L1 deploys (and every other managed L1) carry a
  // `<slug>.firn.gg` URL because the firn indexer is the only one that
  // knows about a brand-new L1 the instant it boots. Putting it first
  // means the single-button case (only Firn available) and the dropdown's
  // top entry both default to Firn rather than a generic "Open Explorer".
  if (customPointsAtFirn && customExplorerUrl) {
    options.push({
      id: 'firn',
      label: 'Firn Explorer',
      url: customExplorerUrl,
      description: 'Per-L1 indexed block explorer',
    });
  }

  // 1. Builder Hub Explorer — in-app option, falls to second when Firn is
  // present. Works whenever there's an EVM chain ID; the slug fallback
  // resolves through wallet's L1ListItem.
  if (evmChainId !== null) {
    options.push({
      id: 'builder-hub',
      label: 'Builder Hub Explorer',
      url: `/explorer/${builderHubExplorerSlug(evmChainId)}`,
      description: 'Native in-app blocks, txs, and addresses',
      internal: true,
    });
  }

  if (!showThirdParty) {
    return options;
  }

  // 2. Avalanche Subnets. Prefer wallet's explorerUrl when it's a Subnets
  // deep link; otherwise the network home.
  const subnetsHome = isTestnet
    ? `https://${SUBNETS_HOST_TESTNET}`
    : `https://${SUBNETS_HOST_MAINNET}`;
  options.push({
    id: 'subnets',
    label: 'Avalanche Subnets',
    url: customPointsAtSubnets && customExplorerUrl ? customExplorerUrl : subnetsHome,
    description:
      customPointsAtSubnets && customExplorerUrl
        ? 'Official Avalanche subnet explorer'
        : 'Browse this L1 on subnets.avax.network',
  });

  // 3. Snowtrace / Routescan. Native to C-Chain; for other L1s lands on
  // the network home so the user can search.
  options.push({
    id: 'snowtrace',
    label: isTestnet ? 'Testnet Snowtrace' : 'Snowtrace',
    url: isTestnet ? 'https://testnet.snowtrace.io' : 'https://snowtrace.io',
    description: isCChain
      ? 'Routescan-powered Etherscan-style explorer'
      : 'Routescan-powered third-party explorer',
  });

  // 4. Custom explorer when the wallet has set a non-Subnets, non-Firn
  // URL; otherwise Avascan. Firn URLs are intentionally skipped from the
  // 'custom' branch so the same chain doesn't get a duplicate generic
  // "L1 Custom Explorer" entry alongside the labeled Firn one above —
  // they fall through to Avascan instead, which is still a useful
  // multichain destination beyond Firn's per-L1 view.
  if (customExplorerUrl && !customPointsAtSubnets && !customPointsAtFirn) {
    options.push({
      id: 'custom',
      label: 'L1 Custom Explorer',
      url: customExplorerUrl,
      description: "Configured by this L1's deployer",
    });
  } else {
    options.push({
      id: 'avascan',
      label: isTestnet ? 'Testnet Avascan' : 'Avascan',
      url: isTestnet ? 'https://testnet.avascan.info' : 'https://avascan.info',
      description: 'Avalanche-native multichain explorer',
    });
  }

  return options;
}
