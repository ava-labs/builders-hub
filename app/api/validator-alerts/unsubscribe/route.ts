import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { verifyUnsubscribeToken } from '@/server/services/unsubscribe-token';

/**
 * GET — render a confirmation page with a button.
 * This is safe for mail scanner prefetch since it performs no state change.
 */
export async function GET(req: NextRequest) {
  const alertId = req.nextUrl.searchParams.get('id');
  const token = req.nextUrl.searchParams.get('token');

  if (!alertId || !token) {
    return htmlResponse(400, 'Invalid Link', 'This unsubscribe link is missing required parameters.');
  }

  if (!verifyUnsubscribeToken(alertId, token)) {
    return htmlResponse(403, 'Invalid Link', 'This unsubscribe link is invalid or has been tampered with.');
  }

  try {
    const alert = await prisma.validatorAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      return htmlResponse(404, 'Not Found', 'This alert no longer exists. It may have already been removed.');
    }

    if (!alert.active) {
      return htmlResponse(200, 'Already Unsubscribed', `Alerts for validator <strong>${alert.node_id}</strong> are already paused.`);
    }

    // Render confirmation page with a form that POSTs
    return htmlResponse(200, 'Unsubscribe from Validator Alerts', `
      <p style="color:#A1A1AA;font-size:16px;line-height:1.6;margin-bottom:24px;">
        Stop receiving email alerts for validator <strong style="color:white;">${alert.node_id}</strong>?
      </p>
      <form method="POST" action="/api/validator-alerts/unsubscribe?id=${alertId}&token=${token}">
        <button type="submit" style="background:#EF4444;color:white;border:none;padding:12px 32px;border-radius:6px;font-size:16px;font-weight:bold;cursor:pointer;">
          Confirm Unsubscribe
        </button>
      </form>
      <p style="color:#71717A;font-size:13px;margin-top:16px;">Or manage your alerts from the <a href="https://build.avax.network/validator-alerts" style="color:#3B82F6;">dashboard</a>.</p>
    `);
  } catch (error) {
    console.error('Error rendering unsubscribe page:', error);
    return htmlResponse(500, 'Error', 'Something went wrong. Please try again or manage your alerts from the dashboard.');
  }
}

/**
 * POST — actually deactivate the alert. Requires the same signed token.
 */
export async function POST(req: NextRequest) {
  const alertId = req.nextUrl.searchParams.get('id');
  const token = req.nextUrl.searchParams.get('token');

  if (!alertId || !token) {
    return htmlResponse(400, 'Invalid Link', 'This unsubscribe link is missing required parameters.');
  }

  if (!verifyUnsubscribeToken(alertId, token)) {
    return htmlResponse(403, 'Invalid Link', 'This unsubscribe link is invalid or has been tampered with.');
  }

  try {
    const alert = await prisma.validatorAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      return htmlResponse(404, 'Not Found', 'This alert no longer exists. It may have already been removed.');
    }

    if (!alert.active) {
      return htmlResponse(200, 'Already Unsubscribed', `Alerts for validator <strong>${alert.node_id}</strong> are already paused.`);
    }

    await prisma.validatorAlert.update({
      where: { id: alertId },
      data: { active: false },
    });

    return htmlResponse(200, 'Unsubscribed',
      `Alerts for validator <strong>${alert.node_id}</strong> have been paused. You can re-enable them from the <a href="https://build.avax.network/validator-alerts" style="color:#3B82F6;">Validator Alerts dashboard</a>.`
    );
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return htmlResponse(500, 'Error', 'Something went wrong. Please try again or manage your alerts from the dashboard.');
  }
}

function htmlResponse(status: number, title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Avalanche Validator Alerts</title></head>
<body style="background:#18181B;color:white;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;">
  <div style="max-width:480px;text-align:center;">
    <h1 style="font-size:24px;margin-bottom:16px;">${title}</h1>
    ${body}
  </div>
</body>
</html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html' } });
}
