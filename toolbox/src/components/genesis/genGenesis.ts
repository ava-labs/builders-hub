import { parseEther } from 'viem'
import { AllowlistPrecompileConfig, AllocationEntry } from './types';
import TransparentUpgradeableProxy from "../../../contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json"
import ProxyAdmin from "../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json"

export const PROXY_ADDRESS = "0xfacade0000000000000000000000000000000000"
export const PROXY_ADMIN_ADDRESS = "0xdad0000000000000000000000000000000000000"
import { addressEntryArrayToAddressArray } from './types';


export const UNITIALIZED_PROXY_ADDRESS = "0x1212121212121212121212121212121212121212"


const currentTimestamp = Math.floor(Date.now() / 1000);

type GenerateGenesisArgs = {
    evmChainId: number;
    tokenAllocations: AllocationEntry[];
    txAllowlistConfig: AllowlistPrecompileConfig,
    contractDeployerAllowlistConfig: AllowlistPrecompileConfig,
    nativeMinterAllowlistConfig: AllowlistPrecompileConfig,
    poaOwnerAddress: string
}

function generateAllowListConfig(config: AllowlistPrecompileConfig) {
    return {
        "blockTimestamp": currentTimestamp,
        ...(config.addresses.Admin.length > 0 && {
            "adminAddresses": addressEntryArrayToAddressArray(config.addresses.Admin),
        }),
        ...(config.addresses.Manager.length > 0 && {
            "managerAddresses": addressEntryArrayToAddressArray(config.addresses.Manager),
        }),
        ...(config.addresses.Enabled.length > 0 && {
            "enabledAddresses": addressEntryArrayToAddressArray(config.addresses.Enabled),
        })
    };
}

function hexTo32Bytes(hex: string) {
    if (hex.slice(0, 2) === "0x") {
        hex = hex.slice(2);
    }
    if (hex.length > 64) {
        throw new Error("Hex string too long");
    }
    return "0x" + hex.padStart(64, "0");
}

export function generateGenesis({ evmChainId, tokenAllocations, txAllowlistConfig, contractDeployerAllowlistConfig, nativeMinterAllowlistConfig, poaOwnerAddress }: GenerateGenesisArgs) {
    // Convert balances to wei
    const allocations: Record<string, { balance: string, code?: string, storage?: Record<string, string>, nonce?: string }> = {};
    tokenAllocations.forEach((allocation) => {
        allocations[allocation.address.toLowerCase().replace('0x', '')] = {
            balance: "0x" + parseEther(allocation.amount.toString()).toString(16)
        };
    });

    allocations[PROXY_ADDRESS.slice(2).toLowerCase()] = {
        balance: "0x0",
        code: TransparentUpgradeableProxy.deployedBytecode.object,
        storage: {
            "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc": hexTo32Bytes(UNITIALIZED_PROXY_ADDRESS.slice(2).toLowerCase()),
            "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103": hexTo32Bytes(PROXY_ADMIN_ADDRESS.slice(2).toLowerCase())
        },
        nonce: "0x1"
    };

    allocations[PROXY_ADMIN_ADDRESS.slice(2).toLowerCase()] = {
        balance: "0x0",
        code: ProxyAdmin.deployedBytecode.object,
        nonce: "0x1",
        storage: {
            "0x0000000000000000000000000000000000000000000000000000000000000000": hexTo32Bytes(poaOwnerAddress),
        }
    };


    return {
        "airdropAmount": null,
        "airdropHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "alloc": {
            ...allocations,
        },
        "baseFeePerGas": null,
        "blobGasUsed": null,
        "coinbase": "0x0000000000000000000000000000000000000000",
        "config": {
            "berlinBlock": 0,
            "byzantiumBlock": 0,
            "chainId": evmChainId,
            "constantinopleBlock": 0,
            "eip150Block": 0,
            "eip155Block": 0,
            "eip158Block": 0,
            "feeConfig": {
                "baseFeeChangeDenominator": 36,
                "blockGasCostStep": 200000,
                "gasLimit": 12000000,
                "maxBlockGasCost": 1000000,
                "minBaseFee": 25000000000,
                "minBlockGasCost": 0,
                "targetBlockRate": 2,
                "targetGas": 60000000
            },
            "homesteadBlock": 0,
            "istanbulBlock": 0,
            "londonBlock": 0,
            "muirGlacierBlock": 0,
            "petersburgBlock": 0,
            "warpConfig": {
                "blockTimestamp": currentTimestamp,
                "quorumNumerator": 67,
                "requirePrimaryNetworkSigners": true
            },
            ...(txAllowlistConfig.activated && {
                "txAllowListConfig": generateAllowListConfig(txAllowlistConfig),
            }),
            ...(contractDeployerAllowlistConfig.activated && {
                "contractDeployerAllowListConfig": generateAllowListConfig(contractDeployerAllowlistConfig),
            }),
            ...(nativeMinterAllowlistConfig.activated && {
                "contractNativeMinterConfig": generateAllowListConfig(nativeMinterAllowlistConfig),
            })
        },
        "difficulty": "0x0",
        "excessBlobGas": null,
        "extraData": "0x",
        "gasLimit": "0xb71b00",
        "gasUsed": "0x0",
        "mixHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "nonce": "0x0",
        "number": "0x0",
        "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "timestamp": `0x${currentTimestamp.toString(16)}`
    }
}
