import { WalletClient, bytesToHex } from "viem";
import {
    utils,
    pvm,
    Context
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { getRPCEndpoint } from "../utils/rpc";

/**
 * Parameters for setting the L1 validator weight on the P-Chain.
 * This is used for both changing weight and removing (setting weight to 0 implicitly).
 */
export type DisableL1ValidatorParams = {
    /** The P-Chain address initiating the transaction. */
    pChainAddress: string;
    /** The validation ID of the validator to disable. */
    validationId: string;
    /** The disable authorization flag. */
    disableAuth: number[];
}

/**
 * Sends a transaction to the P-Chain to disable an L1 validator.
 *
 * @param client The Core WalletClient instance.
 * @param params The parameters required for the transaction.
 * @returns A promise that resolves to the P-Chain transaction ID.
 */
export async function disableL1Validator(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: DisableL1ValidatorParams): Promise<string> {
    const { pChainAddress, validationId, disableAuth } = params;

    const rpcEndpoint = getRPCEndpoint(await isTestnet(client));
    const pvmApi = new pvm.PVMApi(rpcEndpoint);
    const context = await Context.getContextFromURI(rpcEndpoint);

    // Get fee state and UTXOs from P-Chain
    const feeState = await pvmApi.getFeeState();
    const { utxos } = await pvmApi.getUTXOs({ addresses: [pChainAddress] });

    const disableValidatorTx = pvm.e.newDisableL1ValidatorTx(
        {
            validationId,
            disableAuth,
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
            utxos,
        },
        context,
    );

    const disableTxBytes = disableValidatorTx.toBytes();
    const disableTxHex = bytesToHex(disableTxBytes);

    // Submit the transaction to the P-Chain using Core Wallet
    const txID = (await client.request({
        method: "avalanche_sendTransaction",
        params: {
            transactionHex: disableTxHex,
            chainAlias: "P",
        },
    })) as string;

    return txID;
} 