import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Existing badges — only update image URLs
const imageUpdates: { id: string; image_path: string }[] = [
  {
    id: "2blockchainAcademy-1blockchain-fundamentals",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain/Blockchain_Fundamentals_Badge.png",
  },
  {
    id: "2blockchainAcademy-2intro-to-solidity",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain/Intro_Solidity_Badge.png",
  },
  {
    id: "2blockchainAcademy-3nft-deployment",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain/NFT_Deployment_Badge.png",
  },
  {
    id: "2blockchainAcademy-4x402-payments",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain/x402_Badge.png",
  },
  {
    id: "2blockchainAcademy-5encrypted-erc",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain/Encrypted_ERC_Badge.png",
  },
];

// New full-completion badge — awarded when ALL 5 blockchain courses completed
const graduateBadge = {
  id: "2blockchainAcademy-6academy-full-completion",
  name: "Blockchain Academy Graduate",
  description: "Successfully completed all Blockchain Academy courses",
  image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Blockchain/Blockchain_Academy_Badge.png",
  category: "academy",
  requirements: [
    { id: "blockchain-fundamentals-complete", type: "course", unlocked: false, course_id: "blockchain-fundamentals", description: "Complete the Blockchain Fundamentals course" },
    { id: "solidity-foundry-complete", type: "course", unlocked: false, course_id: "solidity-foundry", description: "Complete the Intro to Solidity course" },
    { id: "nft-deployment-complete", type: "course", unlocked: false, course_id: "nft-deployment", description: "Complete the NFT Deployment course" },
    { id: "x402-payment-infrastructure-complete", type: "course", unlocked: false, course_id: "x402-payment-infrastructure", description: "Complete the x402 Payment Infrastructure course" },
    { id: "encrypted-erc-complete", type: "course", unlocked: false, course_id: "encrypted-erc", description: "Complete the Encrypted ERC course" },
  ],
};

async function updateBlockchainBadgeImages() {
  console.log("Updating blockchain academy badge images...");

  for (const { id, image_path } of imageUpdates) {
    const existing = await prisma.badge.findUnique({ where: { id } });
    if (existing) {
      await prisma.badge.update({
        where: { id },
        data: { image_path },
      });
      console.log(`  Updated: ${existing.name}`);
    } else {
      console.log(`  Skipped (not found): ${id}`);
    }
  }

  // Create graduate badge if it doesn't exist
  const existingGrad = await prisma.badge.findUnique({ where: { id: graduateBadge.id } });
  if (existingGrad) {
    await prisma.badge.update({
      where: { id: graduateBadge.id },
      data: { image_path: graduateBadge.image_path },
    });
    console.log(`  Updated: ${graduateBadge.name}`);
  } else {
    await prisma.badge.create({ data: graduateBadge });
    console.log(`  Created: ${graduateBadge.name}`);
  }

  console.log(`Done. ${imageUpdates.length} images updated, graduate badge ensured.`);
}

updateBlockchainBadgeImages()
  .catch((e) => {
    console.error("Error updating blockchain badge images:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
