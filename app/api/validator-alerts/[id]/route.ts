import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import type { UpdateAlertRequest } from '@/types/validator-alerts';

async function getOwnedAlert(alertId: string, userId: string) {
  return prisma.validatorAlert.findFirst({
    where: { id: alertId, user_id: userId },
    include: {
      alert_logs: {
        orderBy: { sent_at: 'desc' },
        take: 20,
      },
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const { id } = await params;
    const alert = await getOwnedAlert(id, session.user.id);
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error fetching validator alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getOwnedAlert(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    }

    const body: UpdateAlertRequest = await req.json();

    const updateData: Record<string, unknown> = {};
    if (body.label !== undefined) updateData.label = body.label;
    if (body.uptime_alert !== undefined) updateData.uptime_alert = body.uptime_alert;
    if (body.uptime_threshold !== undefined) {
      if (body.uptime_threshold < 0 || body.uptime_threshold > 100) {
        return NextResponse.json({ error: 'Uptime threshold must be between 0 and 100.' }, { status: 400 });
      }
      updateData.uptime_threshold = body.uptime_threshold;
    }
    if (body.version_alert !== undefined) updateData.version_alert = body.version_alert;

    const isL1 = existing.subnet_id !== 'primary';

    // L1 validators don't have uptime or expiry — reject attempts to enable
    if (isL1 && body.uptime_alert === true) {
      return NextResponse.json({ error: 'Uptime alerts are not available for L1 validators.' }, { status: 400 });
    }
    if (isL1 && body.expiry_alert === true) {
      return NextResponse.json({ error: 'Stake expiry alerts are not available for L1 validators.' }, { status: 400 });
    }

    if (body.expiry_alert !== undefined) updateData.expiry_alert = body.expiry_alert;
    if (body.expiry_days !== undefined) {
      if (body.expiry_days < 1 || body.expiry_days > 365) {
        return NextResponse.json({ error: 'Expiry days must be between 1 and 365.' }, { status: 400 });
      }
      updateData.expiry_days = body.expiry_days;
    }
    if (body.balance_alert !== undefined) updateData.balance_alert = body.balance_alert;
    if (body.balance_threshold !== undefined) {
      if (body.balance_threshold <= 0) {
        return NextResponse.json({ error: 'Balance threshold must be greater than 0.' }, { status: 400 });
      }
      updateData.balance_threshold = body.balance_threshold;
    }
    if (body.email !== undefined) updateData.email = body.email;
    if (body.active !== undefined) updateData.active = body.active;

    const alert = await prisma.validatorAlert.update({
      where: { id },
      data: updateData,
      include: {
        alert_logs: {
          orderBy: { sent_at: 'desc' },
          take: 20,
        },
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Error updating validator alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const { id } = await params;
    const existing = await getOwnedAlert(id, session.user.id);
    if (!existing) {
      return NextResponse.json({ error: 'Alert not found.' }, { status: 404 });
    }

    await prisma.validatorAlert.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting validator alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
