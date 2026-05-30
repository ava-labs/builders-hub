import { prisma } from "@/prisma/prisma";
import { FULL_STACK_REQUIRED_PATTERNS } from "./types";

// Bronze tier

export async function evaluateFirstBlood(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: { user_id: userId, status: 'success' },
  });
  return count >= 1;
}

export async function evaluateRecruit(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: {
      user_id: userId,
      OR: [
        { action_path: { contains: 'l1_conversion' } },
        { action_path: { contains: 'chain_created' } },
      ],
    },
  });
  return count >= 1;
}

export async function evaluateFunded(userId: string): Promise<boolean> {
  const count = await prisma.faucetClaim.count({
    where: { user_id: userId },
  });
  return count >= 1;
}

export async function evaluateOops(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: { user_id: userId, status: 'error' },
  });
  return count >= 10;
}

// Silver tier

export async function evaluateSerialDeployer(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: {
      user_id: userId,
      action_path: { contains: 'chain_created' },
    },
  });
  return count >= 10;
}

export async function evaluateRascal(userId: string): Promise<boolean> {
  const count = await prisma.faucetClaim.count({
    where: { user_id: userId },
  });
  return count >= 20;
}

export async function evaluateContractFactory(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: {
      user_id: userId,
      action_path: { contains: '/deploy/' },
    },
  });
  return count >= 25;
}

export async function evaluateNodeRunner(userId: string): Promise<boolean> {
  const count = await prisma.nodeRegistration.count({
    where: { user_id: userId },
  });
  return count >= 5;
}

export async function evaluateValidatorWrangler(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: {
      user_id: userId,
      OR: [
        { action_path: { contains: 'validator_registered' } },
        { action_path: { contains: 'validator_added' } },
      ],
    },
  });
  return count >= 10;
}

// Gold tier

export async function evaluateChainLord(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: {
      user_id: userId,
      action_path: { contains: 'chain_created' },
    },
  });
  return count >= 25;
}

export async function evaluateWhale(userId: string): Promise<boolean> {
  const count = await prisma.faucetClaim.count({
    where: { user_id: userId },
  });
  return count >= 50;
}

export async function evaluateFullStack(userId: string): Promise<boolean> {
  for (const pattern of FULL_STACK_REQUIRED_PATTERNS) {
    const count = await prisma.consoleLog.count({
      where: {
        user_id: userId,
        action_path: { contains: pattern },
      },
    });
    if (count < 1) return false;
  }

  const faucetCount = await prisma.faucetClaim.count({
    where: { user_id: userId },
  });
  if (faucetCount < 1) return false;

  const nodeCount = await prisma.nodeRegistration.count({
    where: { user_id: userId },
  });
  return nodeCount >= 1;
}

// Platinum tier

export async function evaluateNuke(userId: string): Promise<boolean> {
  const count = await prisma.consoleLog.count({
    where: { user_id: userId, status: 'success' },
  });
  return count >= 100;
}

export async function evaluateSpeedDemon(userId: string): Promise<boolean> {
  // Find any chain_created log, then check if there's a deploy + validator within 10 min
  const chainCreatedLogs = await prisma.consoleLog.findMany({
    where: {
      user_id: userId,
      action_path: { contains: 'chain_created' },
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  for (const log of chainCreatedLogs) {
    const windowEnd = new Date(log.created_at.getTime() + 10 * 60 * 1000);

    const [deployCount, validatorCount] = await Promise.all([
      prisma.consoleLog.count({
        where: {
          user_id: userId,
          action_path: { contains: '/deploy/' },
          created_at: { gte: log.created_at, lte: windowEnd },
        },
      }),
      prisma.consoleLog.count({
        where: {
          user_id: userId,
          OR: [
            { action_path: { contains: 'validator_registered' } },
            { action_path: { contains: 'validator_added' } },
          ],
          created_at: { gte: log.created_at, lte: windowEnd },
        },
      }),
    ]);

    if (deployCount >= 1 && validatorCount >= 1) return true;
  }

  return false;
}

export async function evaluateNightOwl(userId: string, context?: { timezone?: string }): Promise<boolean> {
  const tz = context?.timezone || 'UTC';
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM "ConsoleLog"
    WHERE user_id = ${userId}
      AND status = 'success'
      AND EXTRACT(HOUR FROM created_at AT TIME ZONE ${tz}) BETWEEN 0 AND 4
  `;
  return Number(result[0]?.count ?? 0) >= 10;
}
