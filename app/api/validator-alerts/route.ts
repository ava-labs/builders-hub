import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import type { CreateAlertRequest } from '@/types/validator-alerts';

const NODE_ID_REGEX = /^NodeID-[A-HJ-NP-Za-km-z1-9]{33,}$/;
const P2P_API_URL = 'https://52.203.183.9.sslip.io/api/validators';

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const alerts = await prisma.validatorAlert.findMany({
      where: { user_id: session.user.id },
      include: {
        alert_logs: {
          orderBy: { sent_at: 'desc' },
          take: 10,
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error fetching validator alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized, please sign in to continue.' }, { status: 401 });
    }

    const body: CreateAlertRequest = await req.json();

    if (!body.node_id || !NODE_ID_REGEX.test(body.node_id)) {
      return NextResponse.json(
        { error: 'Invalid NodeID format. Must start with "NodeID-" followed by a valid base58 string.' },
        { status: 400 }
      );
    }

    // Verify the node exists via upstream API
    const upstreamRes = await fetch(P2P_API_URL);
    if (!upstreamRes.ok) {
      return NextResponse.json({ error: 'Failed to verify validator. Please try again.' }, { status: 502 });
    }
    const validators = await upstreamRes.json();
    const validatorExists = Array.isArray(validators) && validators.some(
      (v: { node_id: string }) => v.node_id === body.node_id
    );
    if (!validatorExists) {
      return NextResponse.json(
        { error: `Validator ${body.node_id} not found in the active validator set.` },
        { status: 404 }
      );
    }

    // Check for existing alert on same node
    const existing = await prisma.validatorAlert.findUnique({
      where: {
        user_id_node_id: {
          user_id: session.user.id,
          node_id: body.node_id,
        },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'You already have an alert configured for this validator.' },
        { status: 409 }
      );
    }

    const email = body.email ?? session.user.email;
    if (!email) {
      return NextResponse.json({ error: 'Email address is required.' }, { status: 400 });
    }

    const alert = await prisma.validatorAlert.create({
      data: {
        user_id: session.user.id,
        node_id: body.node_id,
        label: body.label ?? null,
        uptime_alert: body.uptime_alert ?? true,
        uptime_threshold: body.uptime_threshold ?? 95,
        version_alert: body.version_alert ?? true,
        expiry_alert: body.expiry_alert ?? true,
        expiry_days: body.expiry_days ?? 7,
        email,
      },
      include: {
        alert_logs: true,
      },
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Error creating validator alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
