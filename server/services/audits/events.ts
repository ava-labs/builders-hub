import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuditActorType, AuditEventAction } from "@/lib/audits/status";

// Accepts either the singleton or a transaction client so state-changing
// services can log inside their own transaction (event and change commit or
// roll back together). AuditEventLog is append-only: this is the only writer,
// and nothing anywhere updates or deletes rows.
type AuditDb = PrismaClient | Prisma.TransactionClient;

export interface AuditEventInput {
  request_id?: string | null;
  actor_type: AuditActorType;
  actor_id?: string | null;
  action: AuditEventAction;
  meta?: Prisma.InputJsonValue;
}

export async function logAuditEvent(db: AuditDb, entry: AuditEventInput): Promise<void> {
  await db.auditEventLog.create({
    data: {
      request_id: entry.request_id ?? null,
      actor_type: entry.actor_type,
      actor_id: entry.actor_id ?? null,
      action: entry.action,
      meta: entry.meta ?? {},
    },
  });
}
