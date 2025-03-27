//TODO: bring back when we have Core support for chain overrides
//TODO: add warp support

// import { Chain, Account, assertRequest, BaseError, Client, TransactionRequest, SendTransactionReturnType, SendTransactionParameters, Transport, SendTransactionRequest, formatTransactionRequest } from 'viem'
// import { parseAccount } from 'viem/accounts'
// import { recoverAuthorizationAddress } from 'viem/experimental'
// import { getTransactionError } from 'viem/utils'
// import { extract } from 'viem/utils'


// class AccountNotFoundError extends BaseError {
//     constructor({ docsPath }: { docsPath?: string | undefined } = {}) {
//         super(
//             [
//                 'Could not find an Account to execute with this Action.',
//                 'Please provide an Account with the `account` argument on the Action, or by supplying an `account` to the Client.',
//             ].join('\n'),
//             {
//                 docsPath,
//                 docsSlug: 'account',
//                 name: 'AccountNotFoundError',
//             },
//         )
//     }
// }

// class AccountTypeNotSupportedError extends BaseError {
//     constructor({
//         docsPath,
//         metaMessages,
//         type,
//     }: {
//         docsPath?: string | undefined
//         metaMessages?: string[] | undefined
//         type: string
//     }) {
//         super(`Account type "${type}" is not supported.`, {
//             docsPath,
//             metaMessages,
//             name: 'AccountTypeNotSupportedError',
//         })
//     }
// }

// export async function sendTransaction<
//     chain extends Chain | undefined,
//     account extends Account | undefined,
//     const request extends SendTransactionRequest<chain, chainOverride>,
//     chainOverride extends Chain | undefined = undefined,
// >(
//     client: Client<Transport, chain, account>,
//     parameters: SendTransactionParameters<chain, account, chainOverride, request>,
// ): Promise<SendTransactionReturnType> {
//     const {
//         account: account_ = client.account,
//         chain = client.chain,
//         accessList,
//         authorizationList,
//         blobs,
//         data,
//         gas,
//         gasPrice,
//         maxFeePerBlobGas,
//         maxFeePerGas,
//         maxPriorityFeePerGas,
//         nonce,
//         value,
//         ...rest
//     } = parameters

//     if (typeof account_ === 'undefined')
//         throw new AccountNotFoundError({
//             docsPath: '/docs/actions/wallet/sendTransaction',
//         })
//     const account = account_ ? parseAccount(account_) : null

//     try {
//         assertRequest(parameters)

//         const to = await (async () => {
//             // If `to` exists on the parameters, use that.
//             if (parameters.to) return parameters.to

//             // If `to` is null, we are sending a deployment transaction.
//             if (parameters.to === null) return undefined

//             // If no `to` exists, and we are sending a EIP-7702 transaction, use the
//             // address of the first authorization in the list.
//             if (authorizationList && authorizationList.length > 0)
//                 return await recoverAuthorizationAddress({
//                     authorization: authorizationList[0],
//                 }).catch(() => {
//                     throw new BaseError(
//                         '`to` is required. Could not infer from `authorizationList`.',
//                     )
//                 })

//             // Otherwise, we are sending a deployment transaction.
//             return undefined
//         })()

//         if (account?.type === 'json-rpc' || account === null) {
//             let chainId: number | undefined
//             if (chain) {
//                 chainId = chain.id
//             }

//             const chainFormat = client.chain?.formatters?.transactionRequest?.format
//             const format = chainFormat || formatTransactionRequest

//             const request = format({
//                 // Pick out extra data that might exist on the chain's transaction request type.
//                 ...extract(rest, { format: chainFormat }),
//                 accessList,
//                 authorizationList,
//                 blobs,
//                 chainId,
//                 data,
//                 from: account?.address,
//                 gas,
//                 gasPrice,
//                 maxFeePerBlobGas,
//                 maxFeePerGas,
//                 maxPriorityFeePerGas,
//                 nonce,
//                 to,
//                 value,
//             } as TransactionRequest)

//             const method = 'eth_sendTransaction'

//             try {
//                 return await client.request(
//                     {
//                         method,
//                         params: [request],
//                     },
//                     { retryCount: 0 },
//                 )
//             } catch (e) {
//                 const error = e as BaseError
//                 // If the transport does not support the method or input, attempt to use the
//                 // `wallet_sendTransaction` method.
//                 if (
//                     error.name === 'InvalidInputRpcError' ||
//                     error.name === 'InvalidParamsRpcError' ||
//                     error.name === 'MethodNotFoundRpcError' ||
//                     error.name === 'MethodNotSupportedRpcError'
//                 ) {
//                     return await client
//                         .request(
//                             {
//                                 method: 'wallet_sendTransaction',
//                                 params: [request],
//                             },
//                             { retryCount: 0 },
//                         )
//                         .catch((e) => {
//                             const walletNamespaceError = e as BaseError
//                             if (
//                                 walletNamespaceError.name === 'MethodNotFoundRpcError' ||
//                                 walletNamespaceError.name === 'MethodNotSupportedRpcError'
//                             ) {
//                                 throw error
//                             }

//                             throw walletNamespaceError
//                         })
//                 }

//                 throw error
//             }
//         }

//         throw new AccountTypeNotSupportedError({
//             docsPath: '/docs/actions/wallet/sendTransaction',
//             type: (account as any)?.type,
//         })
//     } catch (err) {
//         if (err instanceof AccountTypeNotSupportedError) throw err
//         throw getTransactionError(err as BaseError, {
//             ...parameters,
//             account,
//             chain: parameters.chain || undefined,
//         })
//     }
// }
