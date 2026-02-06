import type { AvalancheWalletClient } from "@avalanche-sdk/client";

export type DisableL1ValidatorParams = {
    validationId: string;
    disableAuth: number[];
}

export async function disableL1Validator(
    client: AvalancheWalletClient,
    params: DisableL1ValidatorParams
): Promise<string> {
    // Prepare the disable transaction using Avalanche SDK
    const txnRequest = await client.pChain.prepareDisableL1ValidatorTxn({
        validationId: params.validationId,
        disableAuth: params.disableAuth,
    });

    // Send the transaction (this will prompt the user to sign)
    const result = await client.sendXPTransaction(txnRequest);

    return result.txHash;
}
