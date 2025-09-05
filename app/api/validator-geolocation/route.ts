import { NextResponse } from 'next/server';
import { Avalanche } from "@avalanche-sdk/chainkit";

const avalanche = new Avalanche({
  network: "mainnet",
  apiKey: process.env.GLACIER_API_KEY,
});

const PRIMARY_NETWORK_SUBNET_ID = "11111111111111111111111111111111LpoYY";

interface ValidatorGeolocation {
  city: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
}

interface Validator {
  nodeId: string;
  amountStaked: string;
  validationStatus: string;
  avalancheGoVersion: string;
  geolocation: ValidatorGeolocation;
}

interface CountryData {
  country: string;
  countryCode: string;
  validators: number;
  totalStaked: string;
  percentage: number;
  latitude: number;
  longitude: number;
}

let cachedGeoData: { data: CountryData[]; timestamp: number } | null = null;
const CACHE_DURATION = 24 * 60 * 60 * 1000; // updates every 24 hours

async function fetchAllValidators(): Promise<Validator[]> {
  try {
    const allValidators: Validator[] = [];
    const result = await avalanche.data.primaryNetwork.listValidators({
      validationStatus: "active",
      subnetId: PRIMARY_NETWORK_SUBNET_ID,
    });

    for await (const page of result) {
      if (!page?.result?.validators || !Array.isArray(page.result.validators)) {
        console.warn('Invalid page structure:', page);
        continue;
      }

      const validatorsWithGeo = page.result.validators
        .filter((v: any) => v.geolocation && v.geolocation.country)
        .map((v: any): Validator => ({
          nodeId: v.nodeId,
          amountStaked: v.amountStaked,
          validationStatus: v.validationStatus,
          avalancheGoVersion: v.avalancheGoVersion || 'unknown',
          geolocation: {
            city: v.geolocation.city,
            country: v.geolocation.country,
            countryCode: v.geolocation.countryCode,
            latitude: v.geolocation.latitude,
            longitude: v.geolocation.longitude,
          }
        }));
      
      allValidators.push(...validatorsWithGeo);
    }
    return allValidators;
  } catch (error) {
    console.error('Error fetching validators with SDK:', error);
    return [];
  }
}

function aggregateByCountry(validators: Validator[]): CountryData[] {
  const countryMap = new Map<string, {
    validators: number;
    totalStaked: bigint;
    latSum: number;
    lngSum: number;
    countryCode: string;
  }>();

  let totalValidators = validators.length;
  let totalStaked = BigInt(0);

  validators.forEach(validator => {
    const country = validator.geolocation.country;
    const staked = BigInt(validator.amountStaked);
    totalStaked += staked;

    if (!countryMap.has(country)) {
      countryMap.set(country, {
        validators: 0,
        totalStaked: BigInt(0),
        latSum: 0,
        lngSum: 0,
        countryCode: validator.geolocation.countryCode,
      });
    }

    const countryData = countryMap.get(country)!;
    countryData.validators++;
    countryData.totalStaked += staked;
    countryData.latSum += validator.geolocation.latitude;
    countryData.lngSum += validator.geolocation.longitude;
  });

  const result: CountryData[] = [];
  
  countryMap.forEach((data, country) => {
    const percentage = totalValidators > 0 ? (data.validators / totalValidators) * 100 : 0;
    const avgLat = data.validators > 0 ? data.latSum / data.validators : 0;
    const avgLng = data.validators > 0 ? data.lngSum / data.validators : 0;

    result.push({
      country,
      countryCode: data.countryCode,
      validators: data.validators,
      totalStaked: data.totalStaked.toString(),
      percentage,
      latitude: avgLat,
      longitude: avgLng,
    });
  });

  result.sort((a, b) => b.validators - a.validators);
  return result;
}

function latLngToSVG(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng + 180) / 360) * 900;
  const y = ((90 - lat) / 180) * 400;
  
  return { x, y };
}

export async function GET() {
  try {
    if (cachedGeoData && Date.now() - cachedGeoData.timestamp < CACHE_DURATION) {
      return NextResponse.json(cachedGeoData.data, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
          'X-Data-Source': 'cache',
          'X-Cache-Timestamp': new Date(cachedGeoData.timestamp).toISOString(),
        }
      });
    }

    const startTime = Date.now();

    const validators = await fetchAllValidators();
    
    if (validators.length === 0) {
      return NextResponse.json([], {
        headers: {
          'X-Error': 'No validators found',
        }
      });
    }

    const countryData = aggregateByCountry(validators);    
    const countryDataWithCoords = countryData.map(country => ({
      ...country,
      ...latLngToSVG(country.latitude, country.longitude)
    }));
    cachedGeoData = {
      data: countryDataWithCoords,
      timestamp: Date.now()
    };

    const fetchTime = Date.now() - startTime;
    return NextResponse.json(countryDataWithCoords, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
        'X-Data-Source': 'fresh',
        'X-Fetch-Time': `${fetchTime}ms`,
        'X-Total-Validators': validators.length.toString(),
        'X-Total-Countries': countryData.length.toString(),
      }
    });

  } catch (error) {
    console.error('Error in validator geolocation API:', error);
    
    if (cachedGeoData) {
      return NextResponse.json(cachedGeoData.data, {
        headers: {
          'X-Data-Source': 'cache-fallback',
          'X-Error': 'true',
        }
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch validator geolocation data' },
      { status: 500 }
    );
  }
}
