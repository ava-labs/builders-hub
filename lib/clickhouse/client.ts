// ClickHouse HTTP client — connection, auth, query execution, validation helpers

const CLICKHOUSE_URL = process.env.CLICKHOUSE_URL || '';
const CLICKHOUSE_USER = process.env.CLICKHOUSE_USER || 'readonly';
const CLICKHOUSE_PASSWORD = process.env.CLICKHOUSE_PASSWORD || '';
const CLICKHOUSE_DATABASE = process.env.CLICKHOUSE_DATABASE || 'default';

export const C_CHAIN_ID = 43114;

export interface ClickHouseResponse<T> {
  meta: { name: string; type: string }[];
  data: T[];
  rows: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

export async function queryClickHouse<T>(sql: string): Promise<ClickHouseResponse<T>> {
  const response = await fetch(CLICKHOUSE_URL, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': CLICKHOUSE_USER,
      'X-ClickHouse-Key': CLICKHOUSE_PASSWORD,
      'X-ClickHouse-Database': CLICKHOUSE_DATABASE,
    },
    body: sql.includes('FORMAT') ? sql : `${sql} FORMAT JSON`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ClickHouse query failed: ${errorText}`);
  }

  return response.json();
}

// --- Validation helpers ---

export function assertSafeTimeFilter(filter: string): string {
  if (filter === '') return filter;
  const stripped = filter.replace(/\s+/g, ' ').trim();
  if (!/^AND\s/i.test(stripped)) {
    throw new Error(`Invalid time filter: must start with AND`);
  }
  if (/[;]|--|\/\*|\*\/|\bDROP\b|\bDELETE\b|\bINSERT\b|\bUPDATE\b|\bALTER\b|\bTRUNCATE\b/i.test(stripped)) {
    throw new Error(`Invalid time filter: contains forbidden SQL`);
  }
  return filter;
}

export function assertSafeDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`Invalid date for query: ${d}`);
  }
  return d;
}

export function assertSafeDays(days: number): number {
  if (!Number.isFinite(days) || days < 0 || days !== Math.floor(days)) {
    throw new Error(`Invalid days for query: ${days}`);
  }
  return days;
}

export function toUnhex(address: string): string {
  return address.toLowerCase().replace('0x', '');
}

export function toSafeHex(address: string): string {
  const hex = toUnhex(address);
  if (!/^[a-f0-9]{40}$/.test(hex)) {
    throw new Error(`Invalid address for query: ${address}`);
  }
  return hex;
}

const ALLOWED_ADDRESS_COLUMNS = new Set(['to', 'from', 't.to', 't.from', 'tr.to', 'tr.from', 'l.address']);

export function buildAddressFilter(addresses: string[], column: string = 'to'): string {
  if (!ALLOWED_ADDRESS_COLUMNS.has(column)) {
    throw new Error(`buildAddressFilter: disallowed column "${column}"`);
  }
  if (addresses.length === 0) return '1=0';
  if (addresses.length === 1) {
    return `${column} = unhex('${toUnhex(addresses[0])}')`;
  }
  const unhexList = addresses.map(a => `unhex('${toUnhex(a)}')`).join(', ');
  return `${column} IN (${unhexList})`;
}
