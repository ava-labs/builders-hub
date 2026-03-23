import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma/prisma';
import { verifyUnsubscribeToken } from '@/server/services/unsubscribe-token';

export async function GET(req: NextRequest) {
  const alertId = req.nextUrl.searchParams.get('id');
  const token = req.nextUrl.searchParams.get('token');

  if (!alertId || !token) {
    return new NextResponse(htmlPage('Invalid Link', 'This unsubscribe link is missing required parameters.'), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  if (!verifyUnsubscribeToken(alertId, token)) {
    return new NextResponse(htmlPage('Invalid Link', 'This unsubscribe link is invalid or has been tampered with.'), {
      status: 403,
      headers: { 'Content-Type': 'text/html' },
    });
  }

  try {
    const alert = await prisma.validatorAlert.findUnique({ where: { id: alertId } });
    if (!alert) {
      return new NextResponse(htmlPage('Not Found', 'This alert no longer exists. It may have already been removed.'), {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!alert.active) {
      return new NextResponse(htmlPage('Already Unsubscribed', `Alerts for validator ${alert.node_id} are already paused.`), {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    await prisma.validatorAlert.update({
      where: { id: alertId },
      data: { active: false },
    });

    return new NextResponse(
      htmlPage('Unsubscribed', `Alerts for validator ${alert.node_id} have been paused. You can re-enable them from the <a href="https://build.avax.network/validator-alerts" style="color: #3B82F6;">Validator Alerts dashboard</a>.`),
      { headers: { 'Content-Type': 'text/html' } }
    );
  } catch (error) {
    console.error('Error processing unsubscribe:', error);
    return new NextResponse(htmlPage('Error', 'Something went wrong. Please try again or manage your alerts from the dashboard.'), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — Avalanche Validator Alerts</title></head>
<body style="background:#18181B;color:white;font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;">
  <div style="max-width:480px;text-align:center;">
    <h1 style="font-size:24px;margin-bottom:16px;">${title}</h1>
    <p style="color:#A1A1AA;font-size:16px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`;
}
