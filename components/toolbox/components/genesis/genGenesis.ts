import { parseEther } from 'viem'
import { AllowlistPrecompileConfig, AllocationEntry, PreinstallConfig } from './types';
import TransparentUpgradeableProxy from "../../../../contracts/openzeppelin-4.9/compiled/TransparentUpgradeableProxy.json"
import ProxyAdmin from "../../../../contracts/openzeppelin-4.9/compiled/ProxyAdmin.json"
import TeleporterMessenger from "../../../../contracts/icm-contracts/compiled/TeleporterMessenger.json"
import WrappedNativeToken from "../../../../contracts/icm-contracts/compiled/WrappedNativeToken.json"
import Create2Deployer from "../../../../contracts/create2-contracts/compiled/Create2Deployer.json"
import Multicall3 from "../../../../contracts/multicall3-contracts/compiled/Multicall3.json"

const PROXY_ADDRESS = "0xfacade0000000000000000000000000000000000"
const PROXY_ADMIN_ADDRESS = "0xdad0000000000000000000000000000000000000"
import { addressEntryArrayToAddressArray } from './types';

const SAFE_SINGLETON_FACTORY_ADDRESS = "0x914d7Fec6aaC8cd542e72Bca78B30650d45643d7"
const UNITIALIZED_PROXY_ADDRESS = "0x1212121212121212121212121212121212121212"
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11"
const ICM_MESSENGER_ADDRESS = "0x253b2784c75e510dD0fF1da844684a1aC0aa5fcf"
const WRAPPED_NATIVE_TOKEN_ADDRESS = "0x1111111111111111111111111111111111111111"
const CREATE2_DEPLOYER_ADDRESS = "0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2"


const currentTimestamp = Math.floor(Date.now() / 1000);

type GenerateGenesisArgs = {
    evmChainId: number;
    tokenAllocations: AllocationEntry[];
    txAllowlistConfig: AllowlistPrecompileConfig,
    contractDeployerAllowlistConfig: AllowlistPrecompileConfig,
    nativeMinterAllowlistConfig: AllowlistPrecompileConfig,
    poaOwnerAddress: string,
    preinstallConfig?: PreinstallConfig,
    tokenName?: string,
    tokenSymbol?: string
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

export function generateGenesis({ evmChainId, tokenAllocations, txAllowlistConfig, contractDeployerAllowlistConfig, nativeMinterAllowlistConfig, poaOwnerAddress, preinstallConfig, tokenName, tokenSymbol }: GenerateGenesisArgs) {
    // Convert balances to wei
    const allocations: Record<string, { balance: string, code?: string, storage?: Record<string, string>, nonce?: string }> = {};
    tokenAllocations.forEach((allocation) => {
        allocations[allocation.address.toLowerCase().replace('0x', '')] = {
            balance: "0x" + parseEther(allocation.amount.toString()).toString(16)
        };
    });

    // Add preinstalled contracts based on configuration
    if (preinstallConfig?.proxy) {
        allocations[PROXY_ADDRESS.slice(2).toLowerCase()] = {
            balance: "0x0",
            code: TransparentUpgradeableProxy.deployedBytecode.object,
            storage: {
                "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc": hexTo32Bytes(UNITIALIZED_PROXY_ADDRESS.slice(2).toLowerCase()),
                "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103": hexTo32Bytes(PROXY_ADMIN_ADDRESS.slice(2).toLowerCase())
            },
            nonce: "0x1"
        };
    }

    if (preinstallConfig?.proxyAdmin) {
        allocations[PROXY_ADMIN_ADDRESS.slice(2).toLowerCase()] = {
            balance: "0x0",
            code: ProxyAdmin.deployedBytecode.object,
            nonce: "0x1",
            storage: {
                "0x0000000000000000000000000000000000000000000000000000000000000000": hexTo32Bytes(poaOwnerAddress),
            }
        };
    }

    if (preinstallConfig?.safeSingletonFactory) {
        allocations[SAFE_SINGLETON_FACTORY_ADDRESS.slice(2).toLowerCase()] = {
            balance: "0x0",
            code: "0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe03601600081602082378035828234f58015156039578182fd5b8082525050506014600cf3",
            nonce: "0x1",
        };
    }

    if (preinstallConfig?.multicall3) {
        allocations[MULTICALL3_ADDRESS.slice(2).toLowerCase()] = {
            balance: "0x0",
            code: Multicall3.deployedBytecode.object,
            nonce: "0x1",
        };
    }

    if (preinstallConfig?.icmMessenger) {
        // TeleporterMessenger storage layout:
        // Inherits from ReentrancyGuards first, so its storage comes first:
        // Slot 0: _sendEntered (uint256) - from ReentrancyGuards, must be 1 (_NOT_ENTERED)
        // Slot 1: _receiveEntered (uint256) - from ReentrancyGuards, must be 1 (_NOT_ENTERED)
        // Then TeleporterMessenger's storage:
        // Slot 2: blockchainID (bytes32) - will be initialized on first use
        // Slot 3: messageNonce (uint256) - starts at 0
        allocations[ICM_MESSENGER_ADDRESS.slice(2).toLowerCase()] = {
            balance: "0x0",
            code: TeleporterMessenger.deployedBytecode.object,
            nonce: "0x1",
            storage: {
                // Slot 0: _sendEntered - Initialize to 1 (_NOT_ENTERED)
                "0x0000000000000000000000000000000000000000000000000000000000000000": "0x0000000000000000000000000000000000000000000000000000000000000001",
                // Slot 1: _receiveEntered - Initialize to 1 (_NOT_ENTERED)
                "0x0000000000000000000000000000000000000000000000000000000000000001": "0x0000000000000000000000000000000000000000000000000000000000000001"
            }
        };
    }

    if (preinstallConfig?.wrappedNativeToken) {
        // Storage layout for ERC20:
        // Slot 0: _balances mapping (not set directly)
        // Slot 1: _allowances mapping (not set directly)  
        // Slot 2: _totalSupply (uint256) - starts at 0
        // Slot 3: _name (string)
        // Slot 4: _symbol (string)

        // For strings in storage, if length <= 31 bytes, the data is stored as:
        // [data...][length*2] in a single slot
        // If length > 31 bytes, slot contains [length*2+1] and data is stored in keccak256(slot)

        const wrappedTokenName = `Wrapped ${tokenName}`;
        const wrappedTokenSymbol = `W${tokenSymbol}`;

        // Encode name: e.g. "Wrapped AVAX" (dynamic length)
        // Format: [data][length*2] in hex
        const nameHex = "0x" + Buffer.from(wrappedTokenName, 'utf8').toString('hex').padEnd(62, '0') + (wrappedTokenName.length * 2).toString(16).padStart(2, '0');

        // Encode symbol: e.g. "WAVAX" (dynamic length)
        // Format: [data][length*2] in hex
        const symbolHex = "0x" + Buffer.from(wrappedTokenSymbol, 'utf8').toString('hex').padEnd(62, '0') + (wrappedTokenSymbol.length * 2).toString(16).padStart(2, '0');

        allocations[WRAPPED_NATIVE_TOKEN_ADDRESS.slice(2).toLowerCase()] = {
            balance: "0x0",
            code: (WrappedNativeToken.deployedBytecode as any).object,
            nonce: "0x1",
            storage: {
                // Slot 3: _name
                "0x0000000000000000000000000000000000000000000000000000000000000003": nameHex,
                // Slot 4: _symbol  
                "0x0000000000000000000000000000000000000000000000000000000000000004": symbolHex,
            }
        };
    }

    if (preinstallConfig?.create2Deployer) {
        allocations[CREATE2_DEPLOYER_ADDRESS.slice(2).toLowerCase()] = {
            balance: "0x0",
            code: Create2Deployer.deployedBytecode as string,
            nonce: "0x1",
        };
    }

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
