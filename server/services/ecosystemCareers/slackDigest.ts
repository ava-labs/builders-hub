export interface DigestPayload {
  projectsPending: number;
  externalListingsPending: number;
  getroListingsPending: number;
  ingest: {
    getro: { inserted: number; updated: number; skipped: number; error: string | null };
    web3career: { inserted: number; updated: number; skipped: number; error: string | null };
  };
  reviewUrl: string;
}

// Posts a Block Kit payload to a generic webhook URL. Returns null on
// success, an error string on failure. The receiver just needs to accept
// a Slack-shaped JSON POST — Slack, Discord (via Slack-compat adapter),
// Ditto, or any custom internal endpoint all work. Env var:
// SIGNAL_DIGEST_WEBHOOK. Same name for staging/prod; only the URL differs.
export async function postSlackDigest(payload: DigestPayload): Promise<string | null> {
  const webhook = process.env.SIGNAL_DIGEST_WEBHOOK?.trim();
  if (!webhook) return 'SIGNAL_DIGEST_WEBHOOK not configured';

  const totalPending =
    payload.projectsPending + payload.externalListingsPending + payload.getroListingsPending;

  if (totalPending === 0 && !payload.ingest.getro.error && !payload.ingest.web3career.error) {
    // Nothing to review and no ingest errors — skip the noise.
    return null;
  }

  const lines: string[] = [];
  lines.push(`*Ecosystem Careers weekly review* — ${totalPending} pending`);
  if (payload.projectsPending > 0) {
    lines.push(`• ${payload.projectsPending} community project${payload.projectsPending === 1 ? '' : 's'} waiting on first approval`);
  }
  if (payload.getroListingsPending > 0) {
    lines.push(`• ${payload.getroListingsPending} Getro listing${payload.getroListingsPending === 1 ? '' : 's'} pending`);
  }
  if (payload.externalListingsPending > 0) {
    lines.push(`• ${payload.externalListingsPending} web3.career listing${payload.externalListingsPending === 1 ? '' : 's'} pending`);
  }
  if (payload.ingest.getro.error) {
    lines.push(`:warning: Getro ingest error: ${payload.ingest.getro.error}`);
  }
  if (payload.ingest.web3career.error) {
    lines.push(`:warning: web3.career ingest error: ${payload.ingest.web3career.error}`);
  }

  const text = lines.join('\n');
  const body = {
    text,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text } },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open review queue' },
            url: payload.reviewUrl,
            style: 'primary',
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return `Slack webhook ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`;
    }
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : 'slack post failed';
  }
}
