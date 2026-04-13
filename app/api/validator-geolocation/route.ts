import { Avalanche } from '@avalanche-sdk/chainkit';
import { withApi, successResponse } from '@/lib/api';

const avalanche = new Avalanche({
  network: 'mainnet',
  apiKey: process.env.GLACIER_API_KEY,
});

const PRIMARY_NETWORK_SUBNET_ID = '11111111111111111111111111111111LpoYY';

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
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_CONTROL_HEADER = 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=172800';

async function fetchAllValidators(): Promise<Validator[]> {
  const allValidators: Validator[] = [];
  const result = await avalanche.data.primaryNetwork.listValidators({
    validationStatus: 'active',
    subnetId: PRIMARY_NETWORK_SUBNET_ID,
  });

  for await (const page of result) {
    if (!page?.result?.validators || !Array.isArray(page.result.validators)) {
      continue;
    }

    const validatorsWithGeo = page.result.validators
      .filter((v: any) => v.geolocation && v.geolocation.country)
      .map(
        (v: any): Validator => ({
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
          },
        }),
      );

    allValidators.push(...validatorsWithGeo);
  }
  return allValidators;
}

function aggregateByCountry(validators: Validator[]): CountryData[] {
  const countryMap = new Map<
    string,
    {
      validators: number;
      totalStaked: bigint;
      latSum: number;
      lngSum: number;
      countryCode: string;
    }
  >();

  const totalValidators = validators.length;

  validators.forEach((validator) => {
    const country = validator.geolocation.country;
    const staked = BigInt(validator.amountStaked);

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

export const GET = withApi(async () => {
  if (cachedGeoData && Date.now() - cachedGeoData.timestamp < CACHE_DURATION) {
    const resp = successResponse(cachedGeoData.data);
    resp.headers.set('Cache-Control', CACHE_CONTROL_HEADER);
    resp.headers.set('X-Data-Source', 'cache');
    resp.headers.set('X-Cache-Timestamp', new Date(cachedGeoData.timestamp).toISOString());
    return resp;
  }

  const validators = await fetchAllValidators();

  if (validators.length === 0) {
    const resp = successResponse([]);
    resp.headers.set('X-Error', 'No validators found');
    return resp;
  }

  const countryData = aggregateByCountry(validators);
  const countryDataWithCoords = countryData.map((country) => ({
    ...country,
    ...latLngToSVG(country.latitude, country.longitude),
  }));

  cachedGeoData = {
    data: countryDataWithCoords,
    timestamp: Date.now(),
  };

  const resp = successResponse(countryDataWithCoords);
  resp.headers.set('Cache-Control', CACHE_CONTROL_HEADER);
  resp.headers.set('X-Data-Source', 'fresh');
  resp.headers.set('X-Total-Validators', validators.length.toString());
  resp.headers.set('X-Total-Countries', countryData.length.toString());
  return resp;
});
