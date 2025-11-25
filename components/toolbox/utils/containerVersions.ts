import versionsData from '@/scripts/versions.json';

export type ContainerVersions = {
    'avaplatform/avalanchego': string;
    'avaplatform/subnet-evm_avalanchego': string;
    'avaplatform/icm-relayer': string;
};

/**
 * Gets the container versions for the specified network
 * @param isTestnet - Whether to get testnet or mainnet versions
 * @returns Container versions object for the specified network
 */
export const getContainerVersions = (isTestnet: boolean): ContainerVersions => {
    return isTestnet ? versionsData.testnet : versionsData.mainnet;
};
