import { Validator, SubnetInfo, L1ValidatorManagerDetails } from './types';
import { pChainEndpoint } from './consts';
import { AvaCloudSDK } from "@avalabs/avacloud-sdk";
import { useWalletStore } from "@/components/toolbox/stores/walletStore";
const { isTestnet } = useWalletStore();

export const avaCloudSDK = new AvaCloudSDK({
    serverURL: isTestnet ? "https://api.avax-test.network" : "https://api.avax.network",
    chainId: "43114",
    network: "fuji",
});

export async function fetchSubnetIdByValidationID(validationID: string): Promise<string> {
    try {
        const response = await fetch(pChainEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "platform.getL1Validator",
                params: {
                    validationID: validationID
                },
                id: 1
            }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data?.result?.subnetID || '';
    } catch (error) {
        console.error('Error fetching subnetID:', error);
        throw error;
    }
}

export async function fetchValidators(rpcUrl: string): Promise<Validator[]> {
    try {
        const rpcUrlValidators = rpcUrl.replace('/rpc', '/validators');
        const response = await fetch(rpcUrlValidators, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "validators.getCurrentValidators",
                params: {
                    nodeIDs: []
                },
                id: 1
            }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();
        if (!data?.result?.validators) {
            return [];
        }

        return data.result.validators.map((validator: any) => ({
            id: validator.validationID,
            nodeID: validator.nodeID,
            blsPublicKey: validator.blsPublicKey || '',
            blsProofOfPossession: validator.blsProofOfPossession || '',
            pChainAddress: validator.pChainAddress || '',
            weight: validator.weight.toString(),
            uptime: `${validator.uptimePercentage || '0'}%`,
            validationID: validator.validationID,
            startTimestamp: validator.startTimestamp,
            isActive: validator.isActive,
            isL1Validator: validator.isL1Validator,
            isConnected: validator.isConnected,
            uptimeSeconds: validator.uptimeSeconds,
            uptimePercentage: validator.uptimePercentage
        }));
    } catch (error) {
        console.error('Error fetching validators:', error);
        throw error;
    }
}

export async function checkEndpoint(url: string) {
    try {
        console.log('Checking endpoint:', url);

        // Different request body based on endpoint type
        let requestBody;
        if (url.includes('/ext/bc/P')) {
            requestBody = {
                jsonrpc: "2.0",
                method: "platform.getHeight",
                params: {},
                id: 1
            };
        } else if (url.includes('/ext/info')) {
            requestBody = {
                jsonrpc: "2.0",
                method: "info.getNetworkName",
                params: {},
                id: 1
            };
        } else if (url.includes('/validators')) {
            requestBody = {
                jsonrpc: "2.0",
                method: "validators.getCurrentValidators",
                params: {
                    nodeIDs: []
                },
                id: 1
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status, 'for', url);
        const data = await response.json();

        if (data.error) {
            console.error('API Error:', data.error);
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error checking endpoint:', url, error);
        return false;
    }
}

export function getEndpoints(rpcUrl: string) {
    const url = new URL(rpcUrl);
    const baseUrl = url.origin + url.pathname.split('/ext/bc/')[0];
    const queryParams = url.search;
    return {
        platform: `${baseUrl}/ext/bc/P${queryParams}`,
        info: `${baseUrl}/ext/info${queryParams}`,
        validators: rpcUrl.replace('/rpc', '/validators')
    };
}


