import { encodeDeployData } from "viem/utils"

import { DeployContractReturnType, DeployContractParameters } from "viem"

import { Abi } from "viem"

import { Chain, Account, Client, SendTransactionParameters, Transport } from 'viem'
import { sendTransaction } from "./sendTransaction"


export function deployContract<
    const abi extends Abi | readonly unknown[],
    chain extends Chain | undefined,
    account extends Account | undefined,
    chainOverride extends Chain | undefined,
>(
    walletClient: Client<Transport, chain, account>,
    parameters: DeployContractParameters<abi, chain, account, chainOverride>,
): Promise<DeployContractReturnType> {
    const { abi, args, bytecode, ...request } =
        parameters as DeployContractParameters
    const calldata = encodeDeployData({ abi, args, bytecode })
    return sendTransaction(walletClient, {
        ...request,
        ...(request.authorizationList ? { to: null } : {}),
        data: calldata,
    } as unknown as SendTransactionParameters<chain, account, chainOverride>)
}
