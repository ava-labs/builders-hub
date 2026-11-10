import { prisma } from '@/prisma/prisma';
import { sendMail } from '@/server/services/mail';
import {
  LEGACY_NOTICE_ALERT_TYPE,
  LEGACY_NOTIFY_END,
  LEGACY_NOTIFY_SOURCE,
} from '@/server/services/legacy-validator-alerts';
import { legacyNotifyNoticeTemplate } from '@/server/templates/validator-alerts';
import { groupNotices } from '@/scripts/notify-migration/map';

/** Notices per check run. The check route has 60 s, and each send is one SendGrid call. */
export const NOTICES_PER_RUN = 30;

/** Advisory lock key for the notice step, so two overlapping check runs never mail the same address. */
const NOTICE_LOCK_KEY = 4858;

/**
 * Sends the one-time migration notice to imported addresses that have none, at most
 * NOTICES_PER_RUN per call. Returns the ids of imported alerts that still have no notice:
 * the check job skips them, so an address never gets an alert before its notice.
 * Only one run sends at a time. A run that does not get the lock sends nothing.
 */
export async function sendPendingLegacyNotices(): Promise<{
  sent: number;
  failed: number;
  withoutNotice: Set<string>;
}> {
  return prisma.$transaction(
    async (tx) => {
      // A transaction-level lock works through the Neon pooler (PgBouncer, transaction mode).
      const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(${NOTICE_LOCK_KEY}) AS locked`;

      const rows = await tx.validatorAlert.findMany({
        where: { source: LEGACY_NOTIFY_SOURCE, active: true },
        select: {
          id: true,
          email: true,
          node_id: true,
          alert_logs: { where: { alert_type: LEGACY_NOTICE_ALERT_TYPE }, select: { id: true }, take: 1 },
        },
        orderBy: { created_at: 'asc' },
      });
      const { groups } = groupNotices(
        rows.map((r) => ({ id: r.id, email: r.email, node_id: r.node_id, noticed: r.alert_logs.length > 0 })),
      );

      const withoutNotice = new Set(groups.flatMap((g) => g.alerts.map((a) => a.alertId)));
      let sent = 0;
      let failed = 0;
      if (!locked) return { sent, failed, withoutNotice };

      for (const group of groups.slice(0, NOTICES_PER_RUN)) {
        const notice = legacyNotifyNoticeTemplate({ alerts: group.alerts, endDate: LEGACY_NOTIFY_END });
        try {
          await sendMail(group.email, notice.html, notice.subject, notice.text, { logRecipient: false });
        } catch {
          failed++;
          continue;
        }
        // Outside the transaction: a log commits right after its send, even if a later step fails.
        await prisma.validatorAlertLog.createMany({
          data: group.alerts.map((a) => ({
            validator_alert_id: a.alertId,
            alert_type: LEGACY_NOTICE_ALERT_TYPE,
            message: notice.text,
          })),
        });
        // The first alerts wait for the next run, so the notice arrives first.
        sent++;
      }
      return { sent, failed, withoutNotice };
    },
    { maxWait: 10_000, timeout: 45_000 },
  );
}
