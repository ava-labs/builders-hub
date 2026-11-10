import type { FileConfig } from './shared.mts';
import { getCrossChainConfigs } from './cross-chain.mts';
import { getApisConfigs } from './apis.mts';
import { getPrimaryNetworkConfigs } from './primary-network.mts';
import { getAvalancheL1sConfigs } from './avalanche-l1s.mts';
import { getAcpsConfigs } from './acps.mts';
import { getReleasesConfigs } from './releases.mts';
import { getIcmReleasesConfigs } from './icm-releases.mts';
// import { getSDKSConfigs } from './sdks.mts';

export type Section = { name: string; configs: FileConfig[] };

/**
 * Sections whose file lists are written in this repo
 */
export function getFixedSections(): Section[] {
  return [
    { name: 'Cross-Chain', configs: getCrossChainConfigs() },
    { name: 'APIs', configs: getApisConfigs() },
    { name: 'Primary Network', configs: getPrimaryNetworkConfigs() },
    { name: 'Avalanche L1s', configs: getAvalancheL1sConfigs() },
    // { name: 'SDKS', configs: getSDKSConfigs() },
  ];
}

/**
 * Sections whose file lists come from the GitHub API
 */
export async function getGitHubSections(): Promise<Section[]> {
  return [
    { name: 'ACPs', configs: await getAcpsConfigs() },
    { name: 'Releases', configs: await getReleasesConfigs() },
    { name: 'ICM Releases', configs: await getIcmReleasesConfigs() },
  ];
}
