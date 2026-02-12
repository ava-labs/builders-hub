import { prisma } from "@/prisma/prisma";
import { BadgeAwardStatus } from "@/types/badge";
import { ConsoleOperationType, ConsoleBadgeDefinition, CONSOLE_BADGE_NAMES, AwardedConsoleBadge } from "./types";
import {
  evaluateFirstBlood,
  evaluateRecruit,
  evaluateFunded,
  evaluateOops,
  evaluateSerialDeployer,
  evaluateRascal,
  evaluateContractFactory,
  evaluateNodeRunner,
  evaluateValidatorWrangler,
  evaluateChainLord,
  evaluateWhale,
  evaluateFullStack,
  evaluateNuke,
  evaluateSpeedDemon,
  evaluateNightOwl,
} from "./evaluators";

const CONSOLE_BADGES: ConsoleBadgeDefinition[] = [
  // Bronze
  {
    name: CONSOLE_BADGE_NAMES.FIRST_BLOOD,
    tier: 'bronze',
    description: 'Complete your first successful console operation.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier1_FirstKill.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateFirstBlood,
    requirementDescription: '1 successful console operation',
  },
  {
    name: CONSOLE_BADGE_NAMES.RECRUIT,
    tier: 'bronze',
    description: 'Deploy your first L1 blockchain.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier1_Recruit.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateRecruit,
    requirementDescription: '1 L1 conversion or chain creation',
  },
  {
    name: CONSOLE_BADGE_NAMES.FUNDED,
    tier: 'bronze',
    description: 'Claim tokens from the faucet for the first time.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier1_Funded.png',
    triggeredBy: ['faucet_claim'],
    evaluate: evaluateFunded,
    requirementDescription: '1 faucet claim',
  },
  {
    name: CONSOLE_BADGE_NAMES.OOPS,
    tier: 'bronze',
    description: 'Embrace failure — errors are part of the journey.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier4_Oops.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateOops,
    requirementDescription: '10 error operations',
  },
  // Silver
  {
    name: CONSOLE_BADGE_NAMES.SERIAL_DEPLOYER,
    tier: 'silver',
    description: 'Create 10 blockchains. You\'re on a roll.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_SerialDeployer.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateSerialDeployer,
    requirementDescription: '10 chains created',
  },
  {
    name: CONSOLE_BADGE_NAMES.RASCAL,
    tier: 'silver',
    description: 'Claim faucet tokens 20 times. Thirsty much?',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_Rascal.png',
    triggeredBy: ['faucet_claim'],
    evaluate: evaluateRascal,
    requirementDescription: '20 faucet claims',
  },
  {
    name: CONSOLE_BADGE_NAMES.CONTRACT_FACTORY,
    tier: 'silver',
    description: 'Deploy 25 smart contracts through the console.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_ContractFactory.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateContractFactory,
    requirementDescription: '25 contract deployments',
  },
  {
    name: CONSOLE_BADGE_NAMES.NODE_RUNNER,
    tier: 'silver',
    description: 'Register 5 nodes. Building the network.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_NodeRunner.png',
    triggeredBy: ['node_registration'],
    evaluate: evaluateNodeRunner,
    requirementDescription: '5 node registrations',
  },
  {
    name: CONSOLE_BADGE_NAMES.VALIDATOR_WRANGLER,
    tier: 'silver',
    description: 'Register or add 10 validators to your chains.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_ValidatorWrangler.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateValidatorWrangler,
    requirementDescription: '10 validators registered or added',
  },
  // Gold
  {
    name: CONSOLE_BADGE_NAMES.CHAIN_LORD,
    tier: 'gold',
    description: 'Create 25 blockchains. All hail the Chain Lord.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_ChainLord.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateChainLord,
    requirementDescription: '25 chains created',
  },
  {
    name: CONSOLE_BADGE_NAMES.WHALE,
    tier: 'gold',
    description: 'Claim faucet tokens 50 times. You\'re a whale now.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_Whale.png',
    triggeredBy: ['faucet_claim'],
    evaluate: evaluateWhale,
    requirementDescription: '50 faucet claims',
  },
  {
    name: CONSOLE_BADGE_NAMES.FULL_STACK,
    tier: 'gold',
    description: 'Use every console feature: deploy, faucet, nodes, validators, and contracts.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_Fullstack.png',
    triggeredBy: ['console_log', 'faucet_claim', 'node_registration'],
    evaluate: evaluateFullStack,
    requirementDescription: 'Use all console features at least once',
  },
  // Platinum
  {
    name: CONSOLE_BADGE_NAMES.NUKE,
    tier: 'platinum',
    description: 'Complete 100 successful console operations. Unstoppable.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_Nuke.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateNuke,
    requirementDescription: '100 successful console operations',
  },
  {
    name: CONSOLE_BADGE_NAMES.SPEED_DEMON,
    tier: 'platinum',
    description: 'Create a chain, deploy a contract, and add a validator within 10 minutes.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier4_SpeedDemon.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateSpeedDemon,
    requirementDescription: 'Chain + deploy + validator in 10 min',
  },
  {
    name: CONSOLE_BADGE_NAMES.NIGHT_OWL,
    tier: 'platinum',
    description: 'Complete 10 successful operations between midnight and 5 AM. Night shift warrior.',
    imagePath: 'https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier4_NightOwl.png',
    triggeredBy: ['console_log'],
    evaluate: evaluateNightOwl,
    requirementDescription: '10 successful operations between 00:00-05:00',
  },
];

/**
 * Check and award console badges after a console operation.
 * Filters to only badges relevant to the operation type, skips already-awarded ones.
 */
export async function checkAndAwardConsoleBadges(
  userId: string,
  operationType: ConsoleOperationType
): Promise<AwardedConsoleBadge[]> {
  const newlyAwarded: AwardedConsoleBadge[] = [];

  const relevantBadges = CONSOLE_BADGES.filter((badge) =>
    badge.triggeredBy.includes(operationType)
  );

  // Get all console badge records from DB
  const dbBadges = await prisma.badge.findMany({
    where: { category: 'console' },
  });

  const dbBadgeMap = new Map(dbBadges.map((b) => [b.name, b]));

  // Get already-awarded badges for this user
  const awardedBadges = await prisma.userBadge.findMany({
    where: {
      user_id: userId,
      badge_id: { in: dbBadges.map((b) => b.id) },
      status: BadgeAwardStatus.approved,
    },
  });

  const awardedBadgeIds = new Set(awardedBadges.map((b) => b.badge_id));

  for (const badgeDef of relevantBadges) {
    const dbBadge = dbBadgeMap.get(badgeDef.name);
    if (!dbBadge) continue;
    if (awardedBadgeIds.has(dbBadge.id)) continue;

    try {
      const isEarned = await badgeDef.evaluate(userId);
      if (isEarned) {
        await prisma.userBadge.upsert({
          where: {
            user_id_badge_id: {
              user_id: userId,
              badge_id: dbBadge.id,
            },
          },
          update: {
            status: BadgeAwardStatus.approved,
            awarded_at: new Date(),
            awarded_by: 'system',
            evidence: [{ id: '1', description: badgeDef.requirementDescription, unlocked: true }],
          },
          create: {
            user_id: userId,
            badge_id: dbBadge.id,
            status: BadgeAwardStatus.approved,
            awarded_at: new Date(),
            awarded_by: 'system',
            requirements_version: 1,
            evidence: [{ id: '1', description: badgeDef.requirementDescription, unlocked: true }],
          },
        });
        newlyAwarded.push({
          name: badgeDef.name,
          tier: badgeDef.tier,
          description: badgeDef.description,
          imagePath: badgeDef.imagePath,
          requirementDescription: badgeDef.requirementDescription,
        });
      }
    } catch (error) {
      console.error(`Error evaluating console badge "${badgeDef.name}" for user ${userId}:`, error);
    }
  }

  return newlyAwarded;
}

/**
 * Evaluate all 15 console badges for a user (used for retroactive migration and first-load check).
 * Returns the array of newly awarded badges.
 */
export async function evaluateAllConsoleBadges(userId: string): Promise<AwardedConsoleBadge[]> {
  const newlyAwarded: AwardedConsoleBadge[] = [];

  const dbBadges = await prisma.badge.findMany({
    where: { category: 'console' },
  });

  const dbBadgeMap = new Map(dbBadges.map((b) => [b.name, b]));

  const awardedBadges = await prisma.userBadge.findMany({
    where: {
      user_id: userId,
      badge_id: { in: dbBadges.map((b) => b.id) },
      status: BadgeAwardStatus.approved,
    },
  });

  const awardedBadgeIds = new Set(awardedBadges.map((b) => b.badge_id));

  for (const badgeDef of CONSOLE_BADGES) {
    const dbBadge = dbBadgeMap.get(badgeDef.name);
    if (!dbBadge) continue;
    if (awardedBadgeIds.has(dbBadge.id)) continue;

    try {
      const isEarned = await badgeDef.evaluate(userId);
      if (isEarned) {
        await prisma.userBadge.upsert({
          where: {
            user_id_badge_id: {
              user_id: userId,
              badge_id: dbBadge.id,
            },
          },
          update: {
            status: BadgeAwardStatus.approved,
            awarded_at: new Date(),
            awarded_by: 'system',
            evidence: [{ id: '1', description: badgeDef.requirementDescription, unlocked: true }],
          },
          create: {
            user_id: userId,
            badge_id: dbBadge.id,
            status: BadgeAwardStatus.approved,
            awarded_at: new Date(),
            awarded_by: 'system',
            requirements_version: 1,
            evidence: [{ id: '1', description: badgeDef.requirementDescription, unlocked: true }],
          },
        });
        newlyAwarded.push({
          name: badgeDef.name,
          tier: badgeDef.tier,
          description: badgeDef.description,
          imagePath: badgeDef.imagePath,
          requirementDescription: badgeDef.requirementDescription,
        });
      }
    } catch (error) {
      console.error(`Error evaluating console badge "${badgeDef.name}" for user ${userId}:`, error);
    }
  }

  return newlyAwarded;
}
