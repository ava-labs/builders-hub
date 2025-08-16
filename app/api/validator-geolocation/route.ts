import { NextResponse } from 'next/server';

const GLACIER_API_KEY = process.env.GLACIER_API_KEY;
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

interface ValidatorResponse {
  validators: Validator[];
  nextPageToken?: string;
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
const CACHE_DURATION = 10 * 60 * 1000;

async function fetchAllValidators(): Promise<Validator[]> {
  if (!GLACIER_API_KEY) {
    console.log('WARNING: GLACIER_API_KEY not found');
    return [];
  }

  try {
    console.log('Fetching all validators with geolocation data...');
    const allValidators: Validator[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
      const url = new URL('https://glacier-api.avax.network/v1/networks/mainnet/validators');
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('subnetId', PRIMARY_NETWORK_SUBNET_ID);
      url.searchParams.set('validationStatus', 'active');
      
      if (nextPageToken) {
        url.searchParams.set('pageToken', nextPageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'x-glacier-api-key': GLACIER_API_KEY,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.error(`Glacier API failed with status: ${response.status}`);
        break;
      }

      const data: ValidatorResponse = await response.json();
      const validatorsWithGeo = data.validators.filter(v => v.geolocation && v.geolocation.country);
      allValidators.push(...validatorsWithGeo); 
      nextPageToken = data.nextPageToken;
      pageCount++;

      if (pageCount > 50) {
        console.log('Reached maximum page limit');
        break;
      }
      
    } while (nextPageToken);
    return allValidators;
  } catch (error) {
    console.error('Error fetching validators:', error);
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