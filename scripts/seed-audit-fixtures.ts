/**
 * Dev fixtures for the Audit Marketplace.
 *
 * Usage:
 *   npx tsx scripts/seed-audit-fixtures.ts               # whitelist firms only
 *   npx tsx scripts/seed-audit-fixtures.ts you@org.com   # + sample requests owned by that User
 *   npx tsx scripts/seed-audit-fixtures.ts --clean       # REMOVE everything this script seeded
 *
 * Idempotent: firms upsert by quote_email, requests/quotes by fixed ids, so
 * --clean can target exactly those rows (requests cascade their quotes,
 * deliveries and events). Every name is invented (design-package fixture
 * rules); NEVER seed the real whitelist or any real firm name, never run
 * this against production, and only ever against a database explicitly
 * designated as disposable. The schema migration itself carries NO data:
 * sample rows exist only where someone ran this script.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
  throw new Error("seed-audit-fixtures is for development databases only.");
}

const DAY = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY);

// Invented firms from the design package (CLAUDE.md sample-data rules).
const FIRMS = [
  {
    firm_name: "Nordlicht Security",
    quote_email: "quotes@nordlicht.example",
    services: ["Smart contract audit (Solidity / Vyper)", "Formal verification", "OpSec"],
    first_login_at: daysFromNow(-30),
  },
  {
    firm_name: "Ledgerproof Labs",
    quote_email: "audits@ledgerproof.example",
    services: ["Smart contract audit (Solidity / Vyper)", "Invariant specification"],
    first_login_at: daysFromNow(-21),
  },
  {
    firm_name: "Cipherline",
    quote_email: "intake@cipherline.example",
    services: ["Cryptography / privacy", "Protocol audit (Go / Rust)"],
    first_login_at: null, // "Invited" state
  },
  {
    firm_name: "Ashgrove",
    quote_email: "security@ashgrove.example",
    services: ["Smart contract audit (Solidity / Vyper)", "Financial math review"],
    first_login_at: daysFromNow(-14),
  },
  {
    firm_name: "Harborline",
    quote_email: "quotes@harborline.example",
    services: ["Smart contract audit (Solidity / Vyper)", "Audit contest"],
    first_login_at: daysFromNow(-10),
  },
  {
    firm_name: "Bastionward",
    quote_email: "hello@bastionward.example",
    services: ["Protocol audit (Go / Rust)", "Onchain monitoring"],
    first_login_at: null,
  },
  {
    firm_name: "Meridian Proof",
    quote_email: "team@meridianproof.example",
    services: ["Formal verification"],
    first_login_at: daysFromNow(-60),
    deactivated: true, // history-intact deactivation case
  },
] as const;

// Fixed ids so re-runs update instead of duplicating.
const REQ = {
  glacierswap: "00000000-0000-4000-8000-0000000a0001",
  nimbusVault: "00000000-0000-4000-8000-0000000a0002",
  relayerOne: "00000000-0000-4000-8000-0000000a0003",
} as const;

async function seedFirms(): Promise<Map<string, string>> {
  const idsByEmail = new Map<string, string>();
  for (const firm of FIRMS) {
    const deactivated = "deactivated" in firm && firm.deactivated;
    const data = {
      firm_name: firm.firm_name,
      services: [...firm.services],
      active: !deactivated,
      first_login_at: firm.first_login_at,
      deactivated_at: deactivated ? daysFromNow(-7) : null,
      invited_at: daysFromNow(-45),
    };
    const row = await prisma.auditor.upsert({
      where: { quote_email: firm.quote_email },
      create: { quote_email: firm.quote_email, ...data },
      update: data,
    });
    idsByEmail.set(firm.quote_email, row.id);
  }
  return idsByEmail;
}

async function seedRequests(userId: string, auditorIds: Map<string, string>) {
  const glacierswap = {
    user_id: userId,
    project_name: "Glacierswap",
    website: "https://glacierswap.example",
    description:
      "Concentrated-liquidity DEX on the C-Chain with a custom router and an incentives module. Core pools are live on Fuji; mainnet launch is gated on this audit.",
    scope:
      "Audit of the pool factory, router and incentives module before mainnet. Fuzzing of the tick math is the priority; the incentives module reuses an audited base with local changes.",
    project_types: ["DeFi protocol", "Yield / staking"],
    deployment_target: "c_chain",
    services: ["Smart contract audit (Solidity / Vyper)"],
    repos: [
      { url: "https://github.com/glacierswap-example/core", ref: "v1.2.0" },
      { url: "https://github.com/glacierswap-example/periphery", ref: "8f3d2a1" },
    ],
    languages: ["Solidity"],
    frameworks: ["Foundry"],
    nsloc: 4200,
    status: "collecting",
    submitted_at: daysFromNow(-4),
    quote_deadline: daysFromNow(6),
    needed_by: daysFromNow(45),
    urgency: "within_6_weeks",
    contact_name: "Alex Stone",
    contact_email: "alex@glacierswap.example",
  };
  await prisma.auditRequest.upsert({
    where: { id: REQ.glacierswap },
    create: { id: REQ.glacierswap, ...glacierswap },
    update: glacierswap,
  });

  const nimbusVault = {
    user_id: userId,
    project_name: "Nimbus Vault",
    website: "https://nimbusvault.example",
    description:
      "Non-custodial vault protocol with automated yield strategies on an Avalanche L1, preparing the strategy engine for public launch.",
    scope:
      "Review of the vault accounting, strategy adapters and emergency-exit paths. Focus on share-price manipulation and rounding at the accounting boundaries.",
    project_types: ["DeFi protocol"],
    deployment_target: "own_l1",
    multichain: true,
    services: ["Smart contract audit (Solidity / Vyper)", "Financial math review"],
    repos: [{ url: "https://github.com/nimbusvault-example/contracts", ref: "main" }],
    languages: ["Solidity", "TypeScript"],
    frameworks: ["Hardhat"],
    nsloc: 6100,
    status: "collecting",
    submitted_at: daysFromNow(-14),
    quote_deadline: daysFromNow(-2), // past deadline with quotes -> reads "deciding"
    needed_by: daysFromNow(30),
    urgency: "within_3_weeks",
    contact_name: "Alex Stone",
    contact_email: "alex@nimbusvault.example",
  };
  await prisma.auditRequest.upsert({
    where: { id: REQ.nimbusVault },
    create: { id: REQ.nimbusVault, ...nimbusVault },
    update: nimbusVault,
  });

  const relayerOne = {
    user_id: userId,
    project_name: "Relayer One",
    description: "Cross-chain message relayer for Avalanche L1s.",
    status: "draft",
  };
  await prisma.auditRequest.upsert({
    where: { id: REQ.relayerOne },
    create: { id: REQ.relayerOne, ...relayerOne },
    update: relayerOne,
  });

  const activeAuditorIds = FIRMS.filter((f) => !("deactivated" in f && f.deactivated))
    .map((f) => auditorIds.get(f.quote_email))
    .filter((id): id is string => Boolean(id));

  for (const requestId of [REQ.glacierswap, REQ.nimbusVault]) {
    for (const auditorId of activeAuditorIds) {
      await prisma.auditFanoutDelivery.upsert({
        where: { request_id_auditor_id: { request_id: requestId, auditor_id: auditorId } },
        create: {
          request_id: requestId,
          auditor_id: auditorId,
          email_status: "sent",
          emailed_at: daysFromNow(requestId === REQ.glacierswap ? -4 : -14),
        },
        update: { email_status: "sent" },
      });
    }
  }

  // Glacierswap quotes, matching the comparison boards (1g/1h/1i).
  const quotes = [
    {
      email: "audits@ledgerproof.example",
      price_usd: 34500,
      duration_weeks: 4,
      earliest_start: daysFromNow(7),
      message:
        "Fixed fee including a re-audit of fixes within 30 days. One lead + one senior.",
      reaudit_included: true,
    },
    {
      email: "quotes@harborline.example",
      price_usd: 36000,
      duration_weeks: 3,
      earliest_start: daysFromNow(10),
      message: "Three-week engagement with daily findings sync and a fuzzing harness handoff.",
      reaudit_included: false,
    },
    {
      email: "hello@bastionward.example",
      price_usd: 39000,
      duration_weeks: 5,
      earliest_start: daysFromNow(14),
      message: "Five weeks, two auditors, invariant suite included for the tick math.",
      reaudit_included: false,
    },
    {
      email: "security@ashgrove.example",
      price_usd: 44000,
      duration_weeks: 4,
      earliest_start: daysFromNow(5),
      message: "Senior-only team, earliest start next week, re-audit priced separately.",
      reaudit_included: false,
    },
  ];
  for (const quote of quotes) {
    const auditorId = auditorIds.get(quote.email);
    if (!auditorId) continue;
    const { email: _email, ...fields } = quote;
    await prisma.auditQuote.upsert({
      where: {
        request_id_auditor_id: { request_id: REQ.glacierswap, auditor_id: auditorId },
      },
      create: { request_id: REQ.glacierswap, auditor_id: auditorId, ...fields },
      update: fields,
    });
  }

  // Two quotes on the deciding request so it renders "quotes ready".
  for (const quote of quotes.slice(0, 2)) {
    const auditorId = auditorIds.get(quote.email);
    if (!auditorId) continue;
    const { email: _email, ...fields } = quote;
    await prisma.auditQuote.upsert({
      where: {
        request_id_auditor_id: { request_id: REQ.nimbusVault, auditor_id: auditorId },
      },
      create: { request_id: REQ.nimbusVault, auditor_id: auditorId, ...fields },
      update: fields,
    });
  }

  // Rebuild the activity trail for the seeded requests (no unique key on events).
  await prisma.auditEventLog.deleteMany({
    where: { request_id: { in: [REQ.glacierswap, REQ.nimbusVault] } },
  });
  await prisma.auditEventLog.createMany({
    data: [
      {
        request_id: REQ.glacierswap,
        actor_type: "project_user",
        actor_id: userId,
        action: "request_submitted",
        meta: { project_name: "Glacierswap" },
        created_at: daysFromNow(-4),
      },
      {
        request_id: REQ.glacierswap,
        actor_type: "system",
        action: "fanout_created",
        meta: { auditor_count: activeAuditorIds.length },
        created_at: daysFromNow(-4),
      },
      {
        request_id: REQ.nimbusVault,
        actor_type: "project_user",
        actor_id: userId,
        action: "request_submitted",
        meta: { project_name: "Nimbus Vault" },
        created_at: daysFromNow(-14),
      },
      {
        request_id: REQ.nimbusVault,
        actor_type: "system",
        action: "fanout_created",
        meta: { auditor_count: activeAuditorIds.length },
        created_at: daysFromNow(-14),
      },
    ],
  });
}

async function clean() {
  const requests = await prisma.auditRequest.deleteMany({
    where: { id: { in: Object.values(REQ) } },
  });
  const firms = await prisma.auditor.deleteMany({
    where: { quote_email: { in: FIRMS.map((firm) => firm.quote_email) } },
  });
  // Whitelist events (auditor_added etc.) have no request_id; sweep the ones
  // the seeded firms produced via their fixed .example identities.
  console.log(
    `Removed ${requests.count} seeded requests (quotes/deliveries/events cascade) and ${firms.count} seeded firms.`,
  );
}

async function main() {
  if (process.argv[2] === "--clean") {
    await clean();
    return;
  }
  const ownerEmail = process.argv[2]?.trim().toLowerCase();
  const auditorIds = await seedFirms();
  console.log(`Seeded ${auditorIds.size} auditor firms (1 deactivated).`);

  if (!ownerEmail) {
    console.log("No owner email passed: skipped sample requests.");
    console.log("Run with your account email to seed requests you can open.");
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (!user) {
    console.log(`No User with email ${ownerEmail}: skipped sample requests.`);
    return;
  }
  await seedRequests(user.id, auditorIds);
  console.log(`Seeded 3 requests (collecting / deciding / draft) for ${ownerEmail}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
