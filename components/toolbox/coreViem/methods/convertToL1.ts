import { WalletClient } from "viem";
import {
    L1Validator,
    PChainOwner,
    pvmSerial,
    utils,
} from "@avalabs/avalanchejs";
import { CoreWalletRpcSchema } from "../rpcSchema";
import { isTestnet } from "./isTestnet";
import { getPChainAddress } from "./getPChainAddress";
import { getRPCEndpoint } from "../utils/rpc";
import { pvm } from "@avalabs/avalanchejs";
import { Context } from "@avalabs/avalanchejs";

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

export type ConvertToL1PChainOwner = {
    addresses: string[];
    threshold: number;
}

export async function convertToL1(client: WalletClient<any, any, any, CoreWalletRpcSchema>, params: ConvertToL1Params): Promise<string> {
    const rpcEndpoint = getRPCEndpoint(await isTestnet(client));
    const pvmApi = new pvm.PVMApi(rpcEndpoint);
    const feeState = await pvmApi.getFeeState();
    const context = await Context.getContextFromURI(rpcEndpoint);

    const pChainAddress = await getPChainAddress(client);

    const { utxos } = await pvmApi.getUTXOs({
        addresses: [pChainAddress]
    });

    const validators: L1Validator[] = params.validators.map(validator => L1Validator.fromNative(
        validator.nodeID,
        BigInt(validator.validatorWeight),
        BigInt(validator.validatorBalance),
        new pvmSerial.ProofOfPossession(utils.hexToBuffer(validator.nodePOP.publicKey), utils.hexToBuffer(validator.nodePOP.proofOfPossession)),
        PChainOwner.fromNative(
            validator.remainingBalanceOwner.addresses.map(utils.bech32ToBytes),
            validator.remainingBalanceOwner.threshold
        ),
        PChainOwner.fromNative(
            validator.deactivationOwner.addresses.map(utils.bech32ToBytes),
            validator.deactivationOwner.threshold
        )
    ));

    const tx = pvm.e.newConvertSubnetToL1Tx(
        {
            feeState,
            fromAddressesBytes: [utils.bech32ToBytes(pChainAddress)],
            subnetId: params.subnetId,
            utxos,
            chainId: params.chainId,
            validators,
            subnetAuth: params.subnetAuth,
            address: utils.hexToBuffer(params.managerAddress.replace('0x', '')),
        },
        context,
    );

    const transactionID = await window.avalanche!.request({
        method: 'avalanche_sendTransaction',
        params: {
            transactionHex: utils.bufferToHex(tx.toBytes()),
            chainAlias: 'P',
        }
    }) as string;

    return transactionID;
}
