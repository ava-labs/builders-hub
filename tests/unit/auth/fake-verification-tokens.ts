/**
 * In-memory VerificationToken table for the OTP tests.
 *
 * It implements only the Prisma calls that the OTP code makes. Its try-lock
 * ($queryRaw pg_try_advisory_xact_lock) is held until the transaction callback
 * ends, and a second transaction asking for the same key gets false, as in
 * Postgres. Without the lock in the code under test, parallel requests
 * interleave at every await and all read the same counts.
 */

type Row = { identifier: string; token: string; expires: Date };
type DateFilter = { lt?: Date; gt?: Date };
type Where = {
  identifier?: string | { in: string[] };
  token?: string;
  expires?: DateFilter;
};

function matches(row: Row, where: Where = {}): boolean {
  const { identifier, token, expires } = where;
  if (typeof identifier === 'string' && row.identifier !== identifier) return false;
  if (identifier && typeof identifier === 'object' && !identifier.in.includes(row.identifier)) return false;
  if (token !== undefined && row.token !== token) return false;
  if (expires?.lt && !(row.expires < expires.lt)) return false;
  if (expires?.gt && !(row.expires > expires.gt)) return false;
  return true;
}

function createStore() {
  const rows: Row[] = [];
  const heldLocks = new Set<string>();

  const table = {
    async findFirst({ where, orderBy }: { where?: Where; orderBy?: { expires: 'asc' | 'desc' } }) {
      const found = rows.filter((row) => matches(row, where));
      if (orderBy) {
        found.sort((a, b) => (a.expires.getTime() - b.expires.getTime()) * (orderBy.expires === 'asc' ? 1 : -1));
      }
      return found[0] ? { ...found[0] } : null;
    },
    async count({ where }: { where?: Where }) {
      return rows.filter((row) => matches(row, where)).length;
    },
    async create({ data }: { data: Row }) {
      if (rows.some((row) => row.token === data.token)) throw new Error('Unique constraint failed on token');
      rows.push({ ...data });
      return { ...data };
    },
    async updateMany({ where, data }: { where?: Where; data: Partial<Row> }) {
      const found = rows.filter((row) => matches(row, where));
      found.forEach((row) => Object.assign(row, data));
      return { count: found.length };
    },
    async delete({ where }: { where: { identifier_token: { identifier: string; token: string } } }) {
      const index = rows.findIndex(
        (r) => r.identifier === where.identifier_token.identifier && r.token === where.identifier_token.token,
      );
      if (index === -1) throw new Error('Record to delete does not exist');
      return rows.splice(index, 1)[0];
    },
    async deleteMany({ where }: { where?: Where }) {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matches(rows[i], where)) {
          rows.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
  };

  const prisma = {
    verificationToken: table,
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      const mine: string[] = [];
      const tx = {
        verificationToken: table,
        // Called as a tagged template:
        // $queryRaw`SELECT pg_try_advisory_xact_lock(hashtext(${key})) AS locked`.
        async $queryRaw(_strings: TemplateStringsArray, key: string) {
          if (heldLocks.has(key)) return [{ locked: mine.includes(key) }];
          heldLocks.add(key);
          mine.push(key);
          return [{ locked: true }];
        },
      };
      try {
        return await fn(tx);
      } finally {
        mine.forEach((key) => heldLocks.delete(key));
      }
    },
  };

  return {
    rows,
    prisma,
    reset() {
      rows.length = 0;
      heldLocks.clear();
    },
  };
}

export const verificationTokens = createStore();
