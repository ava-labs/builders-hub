import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth/authSession';
import { prisma } from '@/prisma/prisma';
import type { CreateAlertRequest, ValidatorP2P, L1ValidatorData } from '@/types/validator-alerts';
import {
  fetchLatestRelease,
  checkSingleAlert,
  fetchL1Validators,
  checkL1Alert,
  sendWelcomeEmail,
} from '@/server/services/validator-alert-check';
import { getAllMainnetSubnetIds } from '@/server/services/l1-chain-metadata';

const NODE_ID_REGEX = /^NodeID-[A-HJ-NP-Za-km-z1-9]{33,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const P2P_API_URL = 'https://52.203.183.9.sslip.io/api/validators';
const MAX_ALERTS_PER_USER = 20;
const MAX_CREATES_PER_HOUR = 10;

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

    // Validate optional numeric fields
    if (body.uptime_threshold !== undefined && (body.uptime_threshold < 0 || body.uptime_threshold > 100)) {
      return NextResponse.json({ error: 'Uptime threshold must be between 0 and 100.' }, { status: 400 });
    }
    if (body.expiry_days !== undefined && (body.expiry_days < 1 || body.expiry_days > 365)) {
      return NextResponse.json({ error: 'Expiry days must be between 1 and 365.' }, { status: 400 });
    }
    if (body.balance_threshold !== undefined && (!Number.isFinite(body.balance_threshold) || body.balance_threshold <= 0)) {
      return NextResponse.json({ error: 'Balance threshold must be greater than 0.' }, { status: 400 });
    }
    if (body.balance_threshold_days !== undefined && (!Number.isInteger(body.balance_threshold_days) || body.balance_threshold_days < 1 || body.balance_threshold_days > 365)) {
      return NextResponse.json({ error: 'Balance threshold days must be between 1 and 365.' }, { status: 400 });
    }
    if (body.email !== undefined && !EMAIL_REGEX.test(body.email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const email = body.email ?? session.user.email;
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    // Verify the node exists — check Primary Network and/or L1 depending on request.
    let detectedSubnetId = 'primary';
    let validators: ValidatorP2P[] = [];
    let primaryLookupAvailable = false;

    const upstreamRes = await fetch(P2P_API_URL);
    if (upstreamRes.ok) {
      validators = await upstreamRes.json();
      primaryLookupAvailable = true;
    }

    const isPrimaryValidator = primaryLookupAvailable && Array.isArray(validators) && validators.some(
      (v: { node_id: string }) => v.node_id === body.node_id
    );
    const preferredSubnetId = body.subnet_id?.trim();
    const wantsPrimaryOnly = preferredSubnetId === 'primary';
    const wantsSpecificL1 = preferredSubnetId && preferredSubnetId !== 'primary';
    let foundOnL1 = false;

    if (wantsPrimaryOnly) {
      if (!primaryLookupAvailable) {
        return NextResponse.json({ error: 'Primary Network validator lookup is currently unavailable. Please try again.' }, { status: 503 });
      }
      if (!isPrimaryValidator) {
        return NextResponse.json({ error: `Validator ${body.node_id} not found in the Primary Network active validator set.` }, { status: 404 });
      }
      detectedSubnetId = 'primary';
    } else if (wantsSpecificL1 || !isPrimaryValidator) {
      // Search L1(s) when caller requested an L1, or when validator was not found on Primary.
      const subnetIds = wantsSpecificL1 ? [preferredSubnetId] : getAllMainnetSubnetIds();

      for (const subnetId of subnetIds) {
        try {
          const l1Res = await fetch(`${req.nextUrl.origin}/api/chain-validators/${subnetId}`);
          if (!l1Res.ok) continue;
          const l1Data = await l1Res.json();
          const match = Array.isArray(l1Data.validators) && l1Data.validators.some(
            (v: { nodeId: string }) => v.nodeId === body.node_id
          );
          if (match) {
            detectedSubnetId = subnetId;
            foundOnL1 = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!foundOnL1) {
        if (wantsSpecificL1) {
          return NextResponse.json(
            { error: `Validator ${body.node_id} not found in L1 subnet ${preferredSubnetId}.` },
            { status: 404 }
          );
        }
        if (!primaryLookupAvailable) {
          return NextResponse.json(
            { error: 'Primary validator lookup is currently unavailable and the validator was not found on known L1s.' },
            { status: 503 }
          );
        }
        return NextResponse.json(
          { error: `Validator ${body.node_id} not found in the Primary Network or any known L1.` },
          { status: 404 }
        );
      }
    } else {
      detectedSubnetId = 'primary';
    }

    const isL1 = detectedSubnetId !== 'primary';
    const primaryValidator = validators.find((v: ValidatorP2P) => v.node_id === body.node_id) ?? null;

    if (isL1 && body.security_alert === true) {
      return NextResponse.json({ error: 'Security checks are currently available for Primary Network validators only.' }, { status: 400 });
    }
    if (!isL1 && body.balance_alert === true) {
      return NextResponse.json({ error: 'Balance alerts are only available for L1 validators.' }, { status: 400 });
    }

    // Rate limiting + duplicate check + create in a serializable transaction
    // to prevent concurrent requests from bypassing limits
    const userId = session.user.id;
    const txResult = await prisma.$transaction(async (tx) => {
      const existingCount = await tx.validatorAlert.count({
        where: { user_id: userId },
      });
      if (existingCount >= MAX_ALERTS_PER_USER) {
        return { error: `You can have at most ${MAX_ALERTS_PER_USER} validator alerts.`, status: 429 };
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCreates = await tx.validatorAlert.count({
        where: { user_id: userId, created_at: { gte: oneHourAgo } },
      });
      if (recentCreates >= MAX_CREATES_PER_HOUR) {
        return { error: 'Too many alerts created recently. Please try again later.', status: 429 };
      }

      const existing = await tx.validatorAlert.findUnique({
        where: { user_id_node_id_subnet_id: { user_id: userId, node_id: body.node_id, subnet_id: detectedSubnetId } },
      });
      if (existing) {
        return { error: 'You already have an alert configured for this validator.', status: 409 };
      }

      const alert = await tx.validatorAlert.create({
        data: {
          user_id: userId,
          node_id: body.node_id,
          subnet_id: detectedSubnetId,
          label: body.label ?? null,
          // L1 validators don't have uptime or fixed expiry
          uptime_alert: isL1 ? false : (body.uptime_alert ?? true),
          uptime_threshold: body.uptime_threshold ?? 95,
          version_alert: body.version_alert ?? true,
          expiry_alert: isL1 ? false : (body.expiry_alert ?? true),
          expiry_days: body.expiry_days ?? 7,
          balance_alert: isL1 ? (body.balance_alert ?? true) : false,
          balance_threshold: body.balance_threshold ?? 5_000_000_000,
          balance_threshold_days: body.balance_threshold_days ?? 30,
          security_alert: isL1 ? false : (body.security_alert ?? false),
          last_known_ip: !isL1 ? (primaryValidator?.public_ip ?? null) : null,
          email,
        },
        include: { alert_logs: true },
      });

      return { alert };
    }, { isolationLevel: 'Serializable' });

    if ('error' in txResult) {
      return NextResponse.json({ error: txResult.error }, { status: txResult.status });
    }

    // Run immediate checks + welcome email after creation.
    const [releaseResult] = await Promise.allSettled([fetchLatestRelease()]);
    const latestRelease = releaseResult.status === 'fulfilled' ? releaseResult.value : null;

    let l1ValidatorForWelcome: L1ValidatorData | null = null;
    try {
      if (!isL1 && primaryValidator) {
        await checkSingleAlert(txResult.alert, primaryValidator, latestRelease);
      } else if (isL1) {
        const l1Validators = await fetchL1Validators(detectedSubnetId);
        l1ValidatorForWelcome = l1Validators.find((v) => v.nodeId === body.node_id) ?? null;
        if (l1ValidatorForWelcome) {
          await checkL1Alert(txResult.alert, l1ValidatorForWelcome, latestRelease);
        }
      }
    } catch (err) {
      // Non-fatal — the cron will catch it on the next run
      console.error('Immediate alert check failed (non-fatal):', err);
    }

    try {
      if (!isL1) {
        await sendWelcomeEmail(txResult.alert, {
          primaryValidator,
          latestRelease,
        });
      } else {
        await sendWelcomeEmail(txResult.alert, {
          l1Validator: l1ValidatorForWelcome,
          latestRelease,
        });
      }
    } catch (err) {
      console.error('Welcome email send failed (non-fatal):', err);
    }

    const responseAlert = await prisma.validatorAlert.findUnique({
      where: { id: txResult.alert.id },
      include: {
        alert_logs: {
          orderBy: { sent_at: 'desc' },
          take: 20,
        },
      },
    });

    return NextResponse.json(responseAlert ?? txResult.alert, { status: 201 });
  } catch (error) {
    console.error('Error creating validator alert:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
