// Dead links in remote docs, fixed in builders-hub.
//
// utils/remote-content.mts copies markdown from other repositories (ACPs, AvalancheGo, ICM, release notes) into
// content/docs. When an upstream file links to a page that has moved or gone, add an entry here: the key is the
// dead URL, the value is the page to link to. builders-hub owns the fix; the upstream file stays as it is.
//
// The nightly link check (.github/workflows/link-check.yml) lists the dead links. A key matches a whole URL only,
// so give the URL exactly as the upstream file writes it, with its #fragment if it has one.
export const MOVED_LINKS: Record<string, string> = {
  'https://book.getfoundry.sh/reference/cast/cast-send': 'https://www.getfoundry.sh/reference/cast/send',
  'https://www.avax.com': 'https://www.avalanche.com',
  'https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/247-delegation-multiplier-increase-maximum-validator-weight-reduction/README.md':
    'https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/247-delegation-multiplier-increase/README.md',
  'https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/62-disable-addvalidatortx-and-adddelegatortx/13-subnet-only-validators.md':
    'https://github.com/avalanche-foundation/ACPs/blob/main/ACPs/13-subnet-only-validators/README.md',
  'https://github.com/ava-labs/subnet-evm/blob/master/contracts/contracts/interfaces/IWarpMessenger.sol#L43':
    'https://github.com/ava-labs/avalanchego/blob/4d4123f67e9aaee2bcecdcb0b8ff6c4bb38606d1/graft/subnet-evm/precompile/contracts/warp/warpbindings/IWarpMessenger.sol#L48',
  'https://github.com/ava-labs/subnet-evm/blob/master/core/types/block.go#L73':
    'https://github.com/ava-labs/avalanchego/blob/4d4123f67e9aaee2bcecdcb0b8ff6c4bb38606d1/graft/subnet-evm/plugin/evm/customtypes/header_ext.go#L202',
  'https://github.com/ava-labs/subnet-evm/blob/master/core/types/receipt.go#L62':
    'https://github.com/ava-labs/libevm/blob/2c4d255e0a63eb7922d77c6e2163bb03fc0bdf0f/core/types/receipt.go#L52',
  'https://github.com/ava-labs/subnet-evm/blob/master/core/types/log.go#L39':
    'https://github.com/ava-labs/libevm/blob/2c4d255e0a63eb7922d77c6e2163bb03fc0bdf0f/core/types/log.go#L29',
  'https://github.com/ava-labs/subnet-evm/blob/master/x/warp/predicate_test.go#L687':
    'https://github.com/ava-labs/avalanchego/blob/4d4123f67e9aaee2bcecdcb0b8ff6c4bb38606d1/graft/subnet-evm/precompile/contracts/warp/predicate_test.go#L824',
  'https://github.com/ethereum/execution-specs/blob/master/network-upgrades/mainnet-upgrades/cancun.md#included-eips':
    'https://github.com/ethereum/execution-specs/blob/12cc993674d3ffa6e7c4e50647c197ae7148144f/network-upgrades/mainnet-upgrades/cancun.md#included-eips',
  'https://github.com/ethereum/execution-specs/blob/master/network-upgrades/mainnet-upgrades/shanghai.md#included-eips':
    'https://github.com/ethereum/execution-specs/blob/12cc993674d3ffa6e7c4e50647c197ae7148144f/network-upgrades/mainnet-upgrades/shanghai.md#included-eips',
  'https://github.com/avalanche-foundation/ACPs/tree/main/ACPs/194-streaming-asynchronous-execution':
    'https://github.com/avalanche-foundation/ACPs/tree/main/ACPs/194-continuous-execution',
  'https://gist.github.com/navillanueva/cdb9c49c411bd89a9480f05a7afbab37':
    'https://gist.github.com/cdb9c49c411bd89a9480f05a7afbab37',
  'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/contracts/governance/README.md':
    'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/avalanche/governance/README.md',
  'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/contracts/ictt/README.md':
    'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/avalanche/ictt/README.md',
  'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/contracts/teleporter/README.md':
    'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/avalanche/teleporter/README.md',
  'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/contracts/teleporter/registry/README.md':
    'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/avalanche/teleporter/registry/README.md',
  'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/contracts/validator-manager/README.md':
    'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/avalanche/validator-manager/README.md',
  'https://github.com/ava-labs/icm-services/blob/main/icm-contracts/CONTRIBUTING.md':
    'https://github.com/ava-labs/icm-services/blob/main/CONTRIBUTING.md',
  'https://github.com/ava-labs/icm-services/blob/main/relayer/tests/e2e_test.go#L68':
    'https://github.com/ava-labs/icm-services/blob/49b0b048d16886076ba9d5ee9aadfe5c960e461f/icm-contracts/tests/suites/services/services_suite_test.go#L209',
};

// A URL ends at white space, a closing bracket or a quote, so a key never matches the start of a longer URL.
const URL_PATTERN = /https?:\/\/[^\s)\]>"']+/g;

export function rewriteMovedLinks(content: string): string {
  return content.replace(URL_PATTERN, (url) => MOVED_LINKS[url] ?? url);
}
