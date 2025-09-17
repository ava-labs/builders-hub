import { ContractFunctionName, BaseError, ContractFunctionArgs, WriteContractParameters, WriteContractReturnType, EncodeFunctionDataParameters } from "viem"

import { encodeFunctionData, parseAccount } from "viem/utils"

import { Abi } from "viem"

import { Chain, Account, Client, Transport } from 'viem'
import { AccountNotFoundError, sendTransaction } from "./sendTransaction"
import { getContractError } from "viem/utils"


export async function writeContract<
    chain extends Chain | undefined,
    account extends Account | undefined,
    const abi extends Abi | readonly unknown[],
    functionName extends ContractFunctionName<abi, 'nonpayable' | 'payable'>,
    args extends ContractFunctionArgs<
        abi,
        'nonpayable' | 'payable',
        functionName
    >,
    chainOverride extends Chain | undefined,
>(
    client: Client<Transport, chain, account>,
    parameters: WriteContractParameters<
        abi,
        functionName,
        args,
        chain,
        account,
        chainOverride
    >,
): Promise<WriteContractReturnType> {

    if (!parameters.chain) {
        throw new Error('Chain is required for writeContract')
    }


    const {
        abi,
        account: account_ = client.account,
        address,
        args,
        dataSuffix,
        functionName,
        ...request
    } = parameters as WriteContractParameters

    if (typeof account_ === 'undefined')
        throw new AccountNotFoundError({
            docsPath: '/docs/contract/writeContract',
        })
    const account = account_ ? parseAccount(account_) : null

    const data = encodeFunctionData({
        abi,
        args,
        functionName,
    } as EncodeFunctionDataParameters)

    try {
        return await sendTransaction(client, {
            data: `${data}${dataSuffix ? dataSuffix.replace('0x', '') : ''}`,
            to: address,
            account,
            ...request,
        })
    } catch (error) {
        throw getContractError(error as BaseError, {
            abi,
            address,
            args,
            docsPath: '/docs/contract/writeContract',
            functionName,
            sender: account?.address,
        })
    }
}
