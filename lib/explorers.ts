// Explorer URL constructors for an L1. When the L1 already has a configured
// explorer URL, returns up to three options the user can pick between in the
// dashboard's "Open Explorer" dropdown — modeled on the 3-way picker added
// to the dApps page in PR #4093, applied at the L1 level instead of per-tx.
// When no explorer is configured for a non-C-Chain L1, return no options so
// ExplorerMenu can surface the "Setup Explorer" action.
//
//   1. Avalanche Subnets — the official Avalanche-team explorer at
//      subnets[-test].avax.network. For L1s where the wallet's
//      L1ListItem.explorerUrl already points at this domain we surface it
//      directly (deep link). Otherwise we fall back to the network home,
//      since the per-L1 slug varies and isn't reliably derivable from
//      `l1-chains.json` (wallet uses `echo`, l1-chains uses `echo-l1`).
//
//   2. Snowtrace — Routescan-powered, Etherscan-style explorer. Native
//      surface area for C-Chain (snowtrace.io / testnet.snowtrace.io).
//      For non-C-Chain L1s the trigger lands on the testnet/mainnet home
//      so the user can search.
//
//   3. Either L1 Custom Explorer (when the wallet has a non-Subnets
//      explorerUrl set — e.g. a project's bespoke explorer like
//      explorer.dexalot.com) OR Avascan for C-Chain/Subnets-backed entries.
//      Avascan supports L1s and tx/address search across the entire
//      ecosystem at avascan.info / testnet.avascan.info.

const C_CHAIN_FUJI = 43113;
const C_CHAIN_MAINNET = 43114;

export interface ExplorerOption {
  id: 'subnets' | 'snowtrace' | 'custom' | 'avascan';
  label: string;
  url: string;
  /** Short description for tooltip / menu subtitle. */
  description: string;
}

interface ExplorerInputs {
  evmChainId: number | null;
  isTestnet: boolean;
  /** L1's user-set explorer URL from wallet's L1ListItem (optional). */
  customExplorerUrl?: string;
}

const SUBNETS_HOST_TESTNET = 'subnets-test.avax.network';
const SUBNETS_HOST_MAINNET = 'subnets.avax.network';

function isSubnetsUrl(url: string): boolean {
  return url.includes(SUBNETS_HOST_TESTNET) || url.includes(SUBNETS_HOST_MAINNET);
}

export function getExplorerOptions(input: ExplorerInputs): ExplorerOption[] {
  const { evmChainId, isTestnet, customExplorerUrl } = input;
  const isCChain = evmChainId === C_CHAIN_FUJI || evmChainId === C_CHAIN_MAINNET;

  if (!customExplorerUrl && !isCChain) {
    return [];
  }

  const options: ExplorerOption[] = [];
  const customPointsAtSubnets = !!customExplorerUrl && isSubnetsUrl(customExplorerUrl);

  // 1. Avalanche Subnets. Prefer wallet's explorerUrl when it's a Subnets
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

  // 2. Snowtrace / Routescan. Native to C-Chain; for other L1s lands on
  // the network home so the user can search.
  options.push({
    id: 'snowtrace',
    label: isTestnet ? 'Testnet Snowtrace' : 'Snowtrace',
    url: isTestnet ? 'https://testnet.snowtrace.io' : 'https://snowtrace.io',
    description: isCChain
      ? 'Routescan-powered Etherscan-style explorer'
      : 'Routescan-powered third-party explorer',
  });

  // 3. Custom explorer when the wallet has set a non-Subnets URL;
  // otherwise Avascan for C-Chain or Subnets-backed entries.
  if (customExplorerUrl && !customPointsAtSubnets) {
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
