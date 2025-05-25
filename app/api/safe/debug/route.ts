import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Debug endpoint working'
  });
}

export async function POST() {
  try {
    // Test fetching chains
    const chainsResponse = await fetch('https://wallet-client.ash.center/v1/chains');
    const chainsData = await chainsResponse.json();
    
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      chains: chainsData.results.length,
      message: 'POST debug endpoint working, chains API accessible'
    });
  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      error: (error as Error).message,
      message: 'POST debug endpoint failed'
    }, { status: 500 });
  }
} 