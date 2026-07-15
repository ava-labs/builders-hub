/**
 * Manage Devnet faucet coupon codes.
 *
 * A coupon lifts the @avalabs.org gate on the Devnet faucet for external users.
 * Coupons carry no usage budget — the per-user (1/24h) and per-address (2/24h)
 * rate limits still apply on top. Runs against whichever DATABASE_URL is set, so
 * point it at a Neon test branch first; never run against production during dev.
 *
 * Usage (via tsx):
 *   tsx scripts/faucet-coupons.ts create --code HELICON-DEVNET --note "Helicon partners" [--expires 2026-09-01]
 *   tsx scripts/faucet-coupons.ts disable --code HELICON-DEVNET
 *   tsx scripts/faucet-coupons.ts list
 *
 * Equivalent raw SQL (Neon SQL console):
 *   INSERT INTO "FaucetCoupon" ("id","code","active","note","created_at")
 *     VALUES (gen_random_uuid(), 'HELICON-DEVNET', true, 'Helicon partners', now());
 *   UPDATE "FaucetCoupon" SET "active" = false WHERE "code" = 'HELICON-DEVNET';
 *   SELECT "code","active","expires_at","note","created_at"
 *     FROM "FaucetCoupon" ORDER BY "created_at" DESC;
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getFlag(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

async function main() {
  const command = process.argv[2];

  if (command === 'create') {
    const code = getFlag('code');
    if (!code) throw new Error('Missing --code');

    const note = getFlag('note') ?? null;
    const expiresRaw = getFlag('expires');
    const expires_at = expiresRaw ? new Date(expiresRaw) : null;
    if (expires_at && Number.isNaN(expires_at.getTime())) {
      throw new Error(`Invalid --expires date: ${expiresRaw}`);
    }

    const coupon = await prisma.faucetCoupon.create({ data: { code, note, expires_at } });
    console.log(
      `Created coupon "${coupon.code}" (id ${coupon.id})` +
        (expires_at ? `, expires ${expires_at.toISOString()}` : ''),
    );
    return;
  }

  if (command === 'disable') {
    const code = getFlag('code');
    if (!code) throw new Error('Missing --code');

    const result = await prisma.faucetCoupon.updateMany({ where: { code }, data: { active: false } });
    console.log(result.count ? `Disabled coupon "${code}"` : `No coupon found with code "${code}"`);
    return;
  }

  if (command === 'list') {
    const coupons = await prisma.faucetCoupon.findMany({ orderBy: { created_at: 'desc' } });
    if (!coupons.length) {
      console.log('No coupons.');
      return;
    }
    for (const c of coupons) {
      const status = !c.active
        ? 'disabled'
        : c.expires_at && c.expires_at <= new Date()
          ? 'expired'
          : 'active';
      const expiry = c.expires_at ? c.expires_at.toISOString() : 'no expiry';
      console.log(`${c.code}\t${status}\t${expiry}\t${c.note ?? ''}`);
    }
    return;
  }

  throw new Error(
    'Usage: faucet-coupons.ts <create|disable|list> [--code X] [--note "..."] [--expires YYYY-MM-DD]',
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
