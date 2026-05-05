// Function selector → category classification
// Maps the first 4 bytes of tx input data to activity categories.
// Ported from Dune query's selector_class logic.

export const SELECTOR_CATEGORIES: Record<string, string> = {
  // ============ DEX SWAPS ============
  // Uniswap V2 / forks (Trader Joe, Pangolin, SushiSwap)
  '38ed1739': 'DEX', // swapExactTokensForTokens
  '7ff36ab5': 'DEX', // swapExactETHForTokens
  '18cbafe5': 'DEX', // swapExactTokensForETH
  '5c11d795': 'DEX', // swapExactTokensForTokensSupportingFeeOnTransferTokens
  '791ac947': 'DEX', // swapExactTokensForETHSupportingFeeOnTransferTokens
  'b6f9de95': 'DEX', // swapExactETHForTokensSupportingFeeOnTransferTokens
  'fb3bdb41': 'DEX', // swapTokensForExactETH (V2)
  '8803dbee': 'DEX', // swapTokensForExactTokens (V2)
  '4a25d94a': 'DEX', // swapETHForExactTokens (V2)
  // Uniswap V3
  'c04b8d59': 'DEX', // exactInput
  '414bf389': 'DEX', // exactInputSingle
  'f28c0498': 'DEX', // exactOutput
  'db3e2198': 'DEX', // exactOutputSingle
  // Uniswap Universal Router
  '3593564c': 'DEX', // execute(bytes,bytes[],uint256)
  '24856bc3': 'DEX', // execute(bytes,bytes[])
  // LB (Liquidity Book) swaps
  '4b807503': 'DEX', // swapExactTokensForTokens (LB)
  'a0d3c850': 'DEX', // swapExactTokensForAVAX (LB)
  '53c85d42': 'DEX', // swapExactAVAXForTokens (LB)
  'eb813f63': 'DEX', // swapTokensForExactTokens (LB)
  // Aggregator multicalls
  'ac9650d8': 'DEX', // multicall (common in DEX routers)
  '5ae401dc': 'DEX', // multicall(uint256,bytes[])
  // 1inch
  '12aa3caf': 'DEX', // swap (1inch AggregationRouterV5)
  'e449022e': 'DEX', // uniswapV3Swap
  '0502b1c5': 'DEX', // unoswap
  // Odos
  '83bd37f9': 'DEX', // swap (Odos Router V2)
  // KyberSwap
  'e21fd0e9': 'DEX', // swap (KyberSwap)
  // Curve
  '3df02124': 'DEX', // exchange (Curve)
  'a6417ed6': 'DEX', // exchange_underlying (Curve)
  // Balancer
  '52bbbe29': 'DEX', // swap (Balancer)
  'e969f6b3': 'DEX', // batchSwap (Balancer)
  // Liquidity provision
  'e8e33700': 'DEX', // addLiquidity
  'f305d719': 'DEX', // addLiquidityETH
  'baa2abde': 'DEX', // removeLiquidity
  '02751cec': 'DEX', // removeLiquidityETH
  'ded9382a': 'DEX', // removeLiquidityETHWithPermit
  'af2979eb': 'DEX', // removeLiquidityETHSupportingFeeOnTransferTokens

  // ============ ERC-20 TOKEN OPS ============
  'a9059cbb': 'Tokens', // transfer(address,uint256)
  '095ea7b3': 'Tokens', // approve(address,uint256)
  '23b872dd': 'Tokens', // transferFrom(address,address,uint256)
  'd505accf': 'Tokens', // permit (EIP-2612)
  '2e1a7d4d': 'Tokens', // withdraw (WAVAX unwrap)
  'd0e30db0': 'Tokens', // deposit (WAVAX wrap)

  // ============ ICM / ICTT ============
  '5d16225d': 'ICM/ICTT', // sendCrossChainMessage
  'f5c62524': 'ICM/ICTT', // receiveCrossChainMessage
  'c868efaa': 'ICM/ICTT', // retryMessageExecution

  // ============ ERC-4337 (Account Abstraction) ============
  '2213bc0b': 'ERC-4337', // handleOps
  '765e827f': 'ERC-4337', // handleAggregatedOps
  '1fad948c': 'ERC-4337', // handleOps (v0.7)
  'b61d27f6': 'ERC-4337', // execute (SimpleAccount)
  '51945447': 'ERC-4337', // execTransactionFromModule (Safe)
  '6a761202': 'ERC-4337', // execTransaction (Safe)

  // ============ KEEPERS / ORACLES ============
  '0cb2fa6c': 'Keepers', // performUpkeep (Chainlink)
  'afb91b2e': 'Keepers', // transmit (Chainlink OCR)
  '4585e33b': 'Keepers', // checkUpkeep (Chainlink)
  'feaf968c': 'Keepers', // latestRoundData (oracle read)
  'f7a30806': 'Keepers', // requestNewRound

  // ============ NFT ============
  '42842e0e': 'NFT', // safeTransferFrom(address,address,uint256) ERC-721
  'b88d4fde': 'NFT', // safeTransferFrom(address,address,uint256,bytes) ERC-721
  'f242432a': 'NFT', // safeTransferFrom (ERC-1155)
  '2eb2c2d6': 'NFT', // safeBatchTransferFrom (ERC-1155)
  'a22cb465': 'NFT', // setApprovalForAll
  '6352211e': 'NFT', // ownerOf (ERC-721)
  '1249c58b': 'NFT', // mint
  '40c10f19': 'NFT', // mint(address,uint256)
  'a0712d68': 'NFT', // mint(uint256)

  // ============ LENDING ============
  '474cf53d': 'Lending', // deposit (Aave)
  '69328dec': 'Lending', // withdraw (Aave)
  'a415bcad': 'Lending', // borrow (Aave)
  '573ade81': 'Lending', // repay (Aave)
  'e8eda9df': 'Lending', // flashLoan (Aave)
  '1a4d01d2': 'Lending', // mint (Compound/Benqi cToken)
  'db006a75': 'Lending', // redeem (Compound/Benqi cToken)
  'f5e3c462': 'Lending', // redeemUnderlying
  '0e752702': 'Lending', // repayBorrow
  'c5ebeaec': 'Lending', // borrow (Compound/Benqi)

  // ============ STAKING ============
  '3a4b66f1': 'Staking', // stake
  '2e17de78': 'Staking', // unstake
  'a694fc3a': 'Staking', // stake(uint256)
  '4e71d92d': 'Staking', // claim
  'e9fad8ee': 'Staking', // exit (withdraw + claim)
  '3d18b912': 'Staking', // getReward

  // ============ BRIDGE ============
  '9fbf10fc': 'Bridge', // bridge (generic)
  '0f5287b0': 'Bridge', // swapAndBridge (Stargate)
};

/**
 * Classify a transaction by its input data selector (first 4 bytes).
 * Returns the category string or null if unknown.
 */
export function classifyBySelector(inputHex: string): string | null {
  if (!inputHex || inputHex.length < 10) return null;

  // Extract first 4 bytes (8 hex chars after '0x')
  const selector = inputHex.slice(2, 10).toLowerCase();
  return SELECTOR_CATEGORIES[selector] || null;
}
