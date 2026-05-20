// Curated suggestions for the job listing location combobox. The form
// accepts free text — this is just a typeahead source. Keep it short
// enough to scan but cover the obvious patterns (remote regions + tech
// hubs).

export const POPULAR_LOCATIONS: readonly string[] = [
  // Remote first — most common shape
  'Remote (Global)',
  'Remote (US)',
  'Remote (Canada)',
  'Remote (EU)',
  'Remote (UK)',
  'Remote (LATAM)',
  'Remote (APAC)',
  'Remote (EMEA)',

  // US tech hubs
  'New York, USA',
  'San Francisco, USA',
  'Los Angeles, USA',
  'Austin, USA',
  'Boston, USA',
  'Seattle, USA',
  'Chicago, USA',
  'Denver, USA',
  'Miami, USA',
  'Washington DC, USA',

  // Europe
  'London, UK',
  'Berlin, Germany',
  'Paris, France',
  'Amsterdam, Netherlands',
  'Lisbon, Portugal',
  'Madrid, Spain',
  'Barcelona, Spain',
  'Zurich, Switzerland',
  'Zug, Switzerland',
  'Munich, Germany',
  'Dublin, Ireland',
  'Stockholm, Sweden',
  'Copenhagen, Denmark',
  'Warsaw, Poland',
  'Prague, Czechia',

  // Asia + Middle East
  'Singapore',
  'Tokyo, Japan',
  'Hong Kong',
  'Seoul, South Korea',
  'Bangalore, India',
  'Mumbai, India',
  'Tel Aviv, Israel',
  'Dubai, UAE',
  'Abu Dhabi, UAE',
  'Bangkok, Thailand',
  'Hanoi, Vietnam',

  // Americas
  'Toronto, Canada',
  'Vancouver, Canada',
  'Mexico City, Mexico',
  'Buenos Aires, Argentina',
  'São Paulo, Brazil',
  'Bogotá, Colombia',
  'Santiago, Chile',

  // Oceania
  'Sydney, Australia',
  'Melbourne, Australia',

  // Africa
  'Lagos, Nigeria',
  'Cape Town, South Africa',
  'Nairobi, Kenya',
];
