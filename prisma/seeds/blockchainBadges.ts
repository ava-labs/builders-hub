import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Blockchain Academy Badges
 *
 * One badge per course, hexagon badge shape.
 * Courses:
 *   - blockchain-fundamentals
 *   - solidity-foundry
 *   - nft-deployment
 *   - x402-payment-infrastructure
 *   - encrypted-erc
 */

export const blockchainBadges = [
  {
    name: "Blockchain Fundamentals",
    description: "Completed the Blockchain Fundamentals course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain_Fundamentals_Badge.png",
    category: "academy",
    requirements: [
      {
        id: "blockchain-fundamentals-complete",
        course_id: "blockchain-fundamentals",
        type: "course",
        description: "Complete Blockchain Fundamentals",
        unlocked: false,
      },
    ],
  },
  {
    name: "Intro to Solidity",
    description: "Completed the Intro to Solidity course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Intro_Solidity_Badge.png",
    category: "academy",
    requirements: [
      {
        id: "solidity-foundry-complete",
        course_id: "solidity-foundry",
        type: "course",
        description: "Complete Intro to Solidity",
        unlocked: false,
      },
    ],
  },
  {
    name: "NFT Deployment",
    description: "Completed the NFT Deployment course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/NFT_Deployment_Badge.png",
    category: "academy",
    requirements: [
      {
        id: "nft-deployment-complete",
        course_id: "nft-deployment",
        type: "course",
        description: "Complete NFT Deployment",
        unlocked: false,
      },
    ],
  },
  {
    name: "x402 Payment Infrastructure",
    description: "Completed the x402 Payment Infrastructure course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/x402_Badge.png",
    category: "academy",
    requirements: [
      {
        id: "x402-payment-infrastructure-complete",
        course_id: "x402-payment-infrastructure",
        type: "course",
        description: "Complete x402 Payment Infrastructure",
        unlocked: false,
      },
    ],
  },
  {
    name: "Encrypted ERC",
    description: "Completed the Encrypted ERC course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Encrypted_ERC_Badge.png",
    category: "academy",
    requirements: [
      {
        id: "encrypted-erc-complete",
        course_id: "encrypted-erc",
        type: "course",
        description: "Complete Encrypted ERC",
        unlocked: false,
      },
    ],
  },
];

async function seedBlockchainBadges() {
  console.log("Seeding blockchain academy badges...");

  for (const badge of blockchainBadges) {
    const existing = await prisma.badge.findFirst({
      where: {
        name: badge.name,
        category: "academy",
      },
    });

    if (existing) {
      console.log(`  Badge "${badge.name}" already exists, updating...`);
      await prisma.badge.update({
        where: { id: existing.id },
        data: {
          description: badge.description,
          image_path: badge.image_path,
          requirements: badge.requirements,
        },
      });
    } else {
      console.log(`  Creating badge "${badge.name}"...`);
      await prisma.badge.create({
        data: {
          name: badge.name,
          description: badge.description,
          image_path: badge.image_path,
          category: badge.category,
          requirements: badge.requirements,
        },
      });
    }
  }

  console.log(`Seeded ${blockchainBadges.length} blockchain academy badges.`);
}

export default seedBlockchainBadges;

// Allow direct execution
if (require.main === module) {
  seedBlockchainBadges()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
