import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/prisma/prisma";

/**
 * Per-hackathon API keys for partner / judge integrations on the gated
 * `/api/events/[id]/projects` endpoint.
 *
 * Storage model:
 *   - prefix     : first 8 chars of the secret, shown in lists for identification
 *   - hashed_key : SHA-256(secret) hex digest, the only stored representation
 *   - secret itself is shown to the admin exactly once at creation time
 *
 * Verification uses prefix → row lookup + timing-safe equality on the hash.
 */

const SECRET_BYTES = 24; // 24 bytes → 32 base64url chars
const PREFIX_LEN = 8;

function generateSecret(): string {
  return randomBytes(SECRET_BYTES).toString("base64url");
}

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export interface CreateApiKeyResult {
  id: string;
  label: string;
  prefix: string;
  /** Plaintext secret. Returned exactly once; the caller MUST display + discard. */
  secret: string;
  created_at: Date;
}

export async function createApiKey(input: {
  label: string;
  hackathonId: string;
  createdBy: string;
}): Promise<CreateApiKeyResult> {
  const secret = generateSecret();
  const prefix = secret.slice(0, PREFIX_LEN);
  const hashed = hashSecret(secret);

  const row = await prisma.apiKey.create({
    data: {
      label: input.label.trim(),
      prefix,
      hashed_key: hashed,
      hackathon_id: input.hackathonId,
      created_by: input.createdBy,
    },
  });

  return {
    id: row.id,
    label: row.label,
    prefix,
    secret,
    created_at: row.created_at,
  };
}

export async function listApiKeys(hackathonId: string) {
  return prisma.apiKey.findMany({
    where: { hackathon_id: hackathonId },
    select: {
      id: true,
      label: true,
      prefix: true,
      created_at: true,
      created_by: true,
      revoked_at: true,
      last_used_at: true,
    },
    orderBy: [{ revoked_at: "asc" }, { created_at: "desc" }],
  });
}

export async function revokeApiKey(id: string) {
  return prisma.apiKey.update({
    where: { id },
    data: { revoked_at: new Date() },
  });
}

/**
 * Validate a bearer token against the ApiKey table, scoped to a single
 * hackathon. On success, updates `last_used_at` and returns the key id.
 *
 * Falls back to the legacy single env-var `HACKATHON_PROJECTS_API_KEY` when
 * present so PR #4203's test plan continues to work.
 */
export async function verifyApiKey(
  authHeader: string | null | undefined,
  hackathonId: string,
): Promise<{ ok: boolean; keyId?: string }> {
  if (!authHeader) return { ok: false };
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false };
  const provided = match[1].trim();
  if (!provided) return { ok: false };

  // Env-var fallback (legacy).
  const envKey = process.env.HACKATHON_PROJECTS_API_KEY;
  if (envKey && envKey.length === provided.length) {
    const a = Buffer.from(envKey);
    const b = Buffer.from(provided);
    if (timingSafeEqual(a, b)) {
      return { ok: true };
    }
  }

  // DB-backed key lookup. Prefix-first (indexed) then timing-safe hash compare.
  const prefix = provided.slice(0, PREFIX_LEN);
  const candidates = await prisma.apiKey.findMany({
    where: {
      hackathon_id: hackathonId,
      prefix,
      revoked_at: null,
    },
    select: { id: true, hashed_key: true },
  });

  const providedHash = hashSecret(provided);
  for (const c of candidates) {
    const a = Buffer.from(c.hashed_key, "hex");
    const b = Buffer.from(providedHash, "hex");
    if (a.length === b.length && timingSafeEqual(a, b)) {
      // Fire-and-forget `last_used_at` update.
      prisma.apiKey
        .update({ where: { id: c.id }, data: { last_used_at: new Date() } })
        .catch((err) => console.error("[ApiKey] last_used_at update failed:", err));
      return { ok: true, keyId: c.id };
    }
  }

  return { ok: false };
}
