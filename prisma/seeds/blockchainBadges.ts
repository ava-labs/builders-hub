import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface BlockchainBadgeSeed {
  name: string;
  description: string;
  image_path: string;
  category: string;
  requirements: { id: string; course_id: string; type: string; description: string; unlocked: boolean }[];
}

const blockchainBadges: BlockchainBadgeSeed[] = [
  {
    name: "Blockchain Fundamentals",
    description: "Completed the Blockchain Fundamentals course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain_Fundamentals_Badge.png",
    category: "academy",
    requirements: [
      { id: "blockchain-fundamentals-complete", course_id: "blockchain-fundamentals", type: "course", description: "Complete Blockchain Fundamentals", unlocked: false },
    ],
  },
  {
    name: "Intro to Solidity",
    description: "Completed the Intro to Solidity course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Intro_Solidity_Badge.png",
    category: "academy",
    requirements: [
      { id: "solidity-foundry-complete", course_id: "solidity-foundry", type: "course", description: "Complete Intro to Solidity", unlocked: false },
    ],
  },
  {
    name: "NFT Deployment",
    description: "Completed the NFT Deployment course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/NFT_Deployment_Badge.png",
    category: "academy",
    requirements: [
      { id: "nft-deployment-complete", course_id: "nft-deployment", type: "course", description: "Complete NFT Deployment", unlocked: false },
    ],
  },
  {
    name: "x402 Payment Infrastructure",
    description: "Completed the x402 Payment Infrastructure course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/x402_Badge.png",
    category: "academy",
    requirements: [
      { id: "x402-payment-infrastructure-complete", course_id: "x402-payment-infrastructure", type: "course", description: "Complete x402 Payment Infrastructure", unlocked: false },
    ],
  },
  {
    name: "Encrypted ERC",
    description: "Completed the Encrypted ERC course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Encrypted_ERC_Badge.png",
    category: "academy",
    requirements: [
      { id: "encrypted-erc-complete", course_id: "encrypted-erc", type: "course", description: "Complete Encrypted ERC", unlocked: false },
    ],
  },
];

async function seedBlockchainBadges() {
  console.log("Seeding blockchain academy badges...");

  for (const badge of blockchainBadges) {
    const existing = await prisma.badge.findFirst({
      where: { name: badge.name, category: "academy" },
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

  console.log(`Done. ${blockchainBadges.length} blockchain academy badges seeded.`);
}

seedBlockchainBadges()
  .catch((e) => {
    console.error("Error seeding blockchain badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
