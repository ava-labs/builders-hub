import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";

const CACHE_DURATION = 5 * 60 * 1000;
const PAGE_SIZE = 100;
const FETCH_TIMEOUT = 30000;

interface ValidatorData {
  nodeId: string;
  amountStaked: string;
  delegationFee: string;
  validationStatus: string;
  delegatorCount: number;
  amountDelegated: string;
}

let cachedData: {data: ValidatorData[]; timestamp: number} | null = null;

async function fetchAllValidators(): Promise<ValidatorData[]> {
  const avalanche = new Avalanche({ network: "mainnet" });
  const validators: ValidatorData[] = [];
  
  try {
    const result = await avalanche.data.primaryNetwork.listValidators({
      pageSize: PAGE_SIZE,
      validationStatus: "active",
      subnetId: "11111111111111111111111111111111LpoYY",
      network: "mainnet",
    });

    let pageCount = 0;
    const maxPages = 50;
    
    for await (const page of result) {
      pageCount++;
      const pageData = page.result.validators || [];
      if (!Array.isArray(pageData)) { continue; }
      
      const pageValidators = pageData.map((v: any) => ({
        nodeId: v.nodeId,
        amountStaked: v.amountStaked,
        delegationFee: v.delegationFee,
        validationStatus: v.validationStatus,
        delegatorCount: v.delegatorCount || 0,
        amountDelegated: v.amountDelegated || "0",
      }));
      
      validators.push(...pageValidators);     
      if (pageCount >= maxPages) { break; }   
      if (pageValidators.length < PAGE_SIZE) { break; }
    }
    return validators;
  } catch (error: any) {
    throw error;
  }
}

export async function GET(_request: Request) {
  try {
    const now = Date.now();

    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json(
        {
          validators: cachedData.data,
          totalCount: cachedData.data.length,
          network: 'mainnet',
          cached: true,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          }
        }
      );
    }

    const validators = await Promise.race([
      fetchAllValidators(),
      new Promise<ValidatorData[]>((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), FETCH_TIMEOUT)
      )
    ]);
    
    cachedData = {
      data: validators,
      timestamp: now
    };

    return NextResponse.json(
      {
        validators,
        totalCount: validators.length,
        network: 'mainnet',
        cached: false,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        }
      }
    );
  } catch (error: any) {
    console.error('Error fetching validators:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch validators' },
      { status: 500 }
    );
  }
}

