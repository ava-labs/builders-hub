import type { AvalancheWalletClient } from "@avalanche-sdk/client";

export type ConvertToL1Params = {
    managerAddress: string;
    subnetId: string;
    chainId: string;
    subnetAuth: number[];
    validators: ConvertToL1Validator[];
}

export type ConvertToL1Validator = {
    nodeID: string;
    nodePOP: {
        publicKey: string;
        proofOfPossession: string;
    }
    validatorWeight: bigint;
    validatorBalance: bigint;
    remainingBalanceOwner: ConvertToL1PChainOwner;
    deactivationOwner: ConvertToL1PChainOwner;
}

type ConvertToL1PChainOwner = {
    addresses: string[];
    threshold: number;
}

export async function convertToL1(client: AvalancheWalletClient, params: ConvertToL1Params): Promise<string> {
    // Convert validators from our format to SDK format
    const sdkValidators = params.validators.map(validator => ({
        nodeId: validator.nodeID,
        nodePoP: {
            publicKey: validator.nodePOP.publicKey,
            proofOfPossession: validator.nodePOP.proofOfPossession,
        },
        weight: validator.validatorWeight,
        // SDK expects initialBalanceInAvax (number in AVAX), we have validatorBalance (bigint in nanoAVAX)
        initialBalanceInAvax: Number(validator.validatorBalance) / 1e9,
        remainingBalanceOwner: {
            addresses: validator.remainingBalanceOwner.addresses,
            threshold: validator.remainingBalanceOwner.threshold,
        },
        deactivationOwner: {
            addresses: validator.deactivationOwner.addresses,
            threshold: validator.deactivationOwner.threshold,
        },
    }));

    // Prepare the transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareConvertSubnetToL1Txn({
        subnetId: params.subnetId,
        blockchainId: params.chainId,
        managerContractAddress: params.managerAddress,
        validators: sdkValidators,
        subnetAuth: params.subnetAuth,
    });

    // Send the transaction
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
}
