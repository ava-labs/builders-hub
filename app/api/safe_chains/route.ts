import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://wallet-client.ash.center/v1/chains', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `HTTP ${response.status}: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch supported chains' },
      { status: 500 }
    );
  }
} 