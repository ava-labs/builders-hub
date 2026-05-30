import { NextRequest, NextResponse } from "next/server";
import { Avalanche } from "@avalanche-sdk/chainkit";

const avalanche = new Avalanche({
  network: "mainnet",
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ chainId: string; tokenAddress: string }> }
) {
  try {
    const { chainId, tokenAddress } = await context.params;

    // Validate inputs
    if (!chainId || !tokenAddress) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      return NextResponse.json({ error: "Invalid token address format" }, { status: 400 });
    }

    try {
      const result = await avalanche.data.evm.contracts.getMetadata({
        address: tokenAddress,
        chainId: chainId,
      });

      if (!result) {
        return NextResponse.json({});
      }

      // Extract symbol based on contract type
      let symbol: string | undefined;
      if (result.ercType === 'ERC-20' || result.ercType === 'ERC-721' || result.ercType === 'ERC-1155') {
        symbol = result.symbol || undefined;
      }

      return NextResponse.json({
        name: result.name || undefined,
        symbol,
        logoUri: result.logoAsset?.imageUri || undefined,
        ercType: result.ercType || undefined,
      });
    } catch (error) {
      // Glacier API might not have data for this token
      return NextResponse.json({});
    }
  } catch (error) {
    console.error("Error fetching token metadata:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

