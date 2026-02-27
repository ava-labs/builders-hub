import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ConsoleBadgeSeed {
  name: string;
  description: string;
  image_path: string;
  category: string;
  requirements: { id: string; description: string; unlocked: boolean }[];
}

const consoleBadges: ConsoleBadgeSeed[] = [
  // Bronze
  {
    name: "First Blood",
    description: "Complete your first successful console operation.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier1_FirstKill.png",
    category: "console",
    requirements: [{ id: "1", description: "1 successful console operation", unlocked: false }],
  },
  {
    name: "Recruit",
    description: "Deploy your first L1 blockchain.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier1_Recruit.png",
    category: "console",
    requirements: [{ id: "1", description: "1 L1 conversion or chain creation", unlocked: false }],
  },
  {
    name: "Funded",
    description: "Claim tokens from the faucet for the first time.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier1_Funded.png",
    category: "console",
    requirements: [{ id: "1", description: "1 faucet claim", unlocked: false }],
  },
  {
    name: "Oops",
    description: "Embrace failure — errors are part of the journey.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier4_Oops.png",
    category: "console",
    requirements: [{ id: "1", description: "10 error operations", unlocked: false }],
  },
  // Silver
  {
    name: "Serial Deployer",
    description: "Create 10 blockchains. You're on a roll.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_SerialDeployer.png",
    category: "console",
    requirements: [{ id: "1", description: "10 chains created", unlocked: false }],
  },
  {
    name: "Rascal",
    description: "Claim faucet tokens 20 times. Thirsty much?",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_Rascal.png",
    category: "console",
    requirements: [{ id: "1", description: "20 faucet claims", unlocked: false }],
  },
  {
    name: "Contract Factory",
    description: "Deploy 25 smart contracts through the console.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_ContractFactory.png",
    category: "console",
    requirements: [{ id: "1", description: "25 contract deployments", unlocked: false }],
  },
  {
    name: "Node Runner",
    description: "Register 5 nodes. Building the network.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_NodeRunner.png",
    category: "console",
    requirements: [{ id: "1", description: "5 node registrations", unlocked: false }],
  },
  {
    name: "Validator Wrangler",
    description: "Register or add 10 validators to your chains.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier2_ValidatorWrangler.png",
    category: "console",
    requirements: [{ id: "1", description: "10 validators registered or added", unlocked: false }],
  },
  // Gold
  {
    name: "Chain Lord",
    description: "Create 25 blockchains. All hail the Chain Lord.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_ChainLord.png",
    category: "console",
    requirements: [{ id: "1", description: "25 chains created", unlocked: false }],
  },
  {
    name: "Whale",
    description: "Claim faucet tokens 50 times. You're a whale now.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_Whale.png",
    category: "console",
    requirements: [{ id: "1", description: "50 faucet claims", unlocked: false }],
  },
  {
    name: "Full Stack",
    description: "Use every console feature: deploy, faucet, nodes, validators, and contracts.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_Fullstack.png",
    category: "console",
    requirements: [{ id: "1", description: "Use all console features at least once", unlocked: false }],
  },
  // Platinum
  {
    name: "Nuke",
    description: "Complete 100 successful console operations. Unstoppable.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier3_Nuke.png",
    category: "console",
    requirements: [{ id: "1", description: "100 successful console operations", unlocked: false }],
  },
  {
    name: "Speed Demon",
    description: "Create a chain, deploy a contract, and add a validator within 10 minutes.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier4_SpeedDemon.png",
    category: "console",
    requirements: [{ id: "1", description: "Chain + deploy + validator in 10 min", unlocked: false }],
  },
  {
    name: "Night Owl",
    description: "Complete 10 successful operations between midnight and 5 AM. Night shift warrior.",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/console_badges/Tier4_NightOwl.png",
    category: "console",
    requirements: [{ id: "1", description: "10 successful operations between 00:00-05:00", unlocked: false }],
  },
];

async function seedConsoleBadges() {
  console.log("Seeding console badges...");

  for (const badge of consoleBadges) {
    const existing = await prisma.badge.findFirst({
      where: { name: badge.name, category: "console" },
    });

    if (existing) {
      await prisma.badge.update({
        where: { id: existing.id },
        data: {
          description: badge.description,
          image_path: badge.image_path,
          requirements: badge.requirements,
        },
      });
      console.log(`  Updated: ${badge.name}`);
    } else {
      await prisma.badge.create({
        data: {
          name: badge.name,
          description: badge.description,
          image_path: badge.image_path,
          category: badge.category,
          requirements: badge.requirements,
        },
      });
      console.log(`  Created: ${badge.name}`);
    }
  }

  console.log(`Done. ${consoleBadges.length} console badges seeded.`);
}

seedConsoleBadges()
  .catch((e) => {
    console.error("Error seeding console badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
