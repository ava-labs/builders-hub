import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface AvalancheL1BadgeSeed {
  id: string;
  name: string;
  description: string;
  image_path: string;
  category: string;
  requirements: { id: string; course_id: string; type: string; description: string; unlocked: boolean }[];
}

const avalancheL1Badges: AvalancheL1BadgeSeed[] = [
  {
    id: "avalanchel1academy-avalanche-fundamentals",
    name: "Avalanche Fundamentals",
    description: "Completed the Avalanche Fundamentals course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Avalanche_Fundamentals_Badge.png",
    category: "academy",
    requirements: [
      { id: "avalanche-fundamentals-complete", course_id: "avalanche-fundamentals", type: "course", description: "Complete Avalanche Fundamentals", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-customizing-evm",
    name: "Customizing the EVM",
    description: "Completed the Customizing the EVM course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Customizing_EVM_Badge.png",
    category: "academy",
    requirements: [
      { id: "customizing-evm-complete", course_id: "customizing-evm", type: "course", description: "Complete Customizing the EVM", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-interchain-messaging",
    name: "Interchain Messaging",
    description: "Completed the Interchain Messaging course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/ICM_Badge.png",
    category: "academy",
    requirements: [
      { id: "interchain-messaging-complete", course_id: "interchain-messaging", type: "course", description: "Complete Interchain Messaging", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-erc20-bridge",
    name: "ERC-20 Bridge",
    description: "Completed the ERC-20 Bridge course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/ERC20_Bridge_Badge.png",
    category: "academy",
    requirements: [
      { id: "erc20-bridge-complete", course_id: "erc20-bridge", type: "course", description: "Complete ERC-20 Bridge", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-native-token-bridge",
    name: "Native Token Bridge",
    description: "Completed the Native Token Bridge course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Native_Token_Bridge.png",
    category: "academy",
    requirements: [
      { id: "native-token-bridge-complete", course_id: "native-token-bridge", type: "course", description: "Complete Native Token Bridge", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-l1-native-tokenomics",
    name: "L1 Native Tokenomics",
    description: "Completed the L1 Native Tokenomics course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/L1_Native_Tokenomics_Badge.png",
    category: "academy",
    requirements: [
      { id: "l1-native-tokenomics-complete", course_id: "l1-native-tokenomics", type: "course", description: "Complete L1 Native Tokenomics", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-permissioned-l1s",
    name: "Permissioned L1s",
    description: "Completed the Permissioned L1s course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Permissioned_L1s_Badge.png",
    category: "academy",
    requirements: [
      { id: "permissioned-l1s-complete", course_id: "permissioned-l1s", type: "course", description: "Complete Permissioned L1s", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-permissionless-l1s",
    name: "Permissionless L1s",
    description: "Completed the Permissionless L1s course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Permissionless_L1s_Badge.png",
    category: "academy",
    requirements: [
      { id: "permissionless-l1s-complete", course_id: "permissionless-l1s", type: "course", description: "Complete Permissionless L1s", unlocked: false },
    ],
  },
  {
    id: "avalanchel1academy-access-restriction",
    name: "Access Restriction",
    description: "Completed the Access Restriction course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Access_Restriction_Badge.png",
    category: "academy",
    requirements: [
      { id: "access-restriction-complete", course_id: "access-restriction", type: "course", description: "Complete Access Restriction", unlocked: false },
    ],
  },
];

async function seedAvalancheL1Badges() {
  console.log("Seeding Avalanche L1 academy badges...");

  for (const badge of avalancheL1Badges) {
    const existing = await prisma.badge.findFirst({
      where: { name: badge.name, category: "academy" },
    });

    if (existing) {
      await prisma.badge.update({
        where: { id: existing.id },
        data: {
          id: badge.id,
          description: badge.description,
          image_path: badge.image_path,
          requirements: badge.requirements,
        },
      });
      console.log(`  Updated: ${badge.name}`);
    } else {
      await prisma.badge.create({
        data: {
          id: badge.id,
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

  console.log(`Done. ${avalancheL1Badges.length} Avalanche L1 academy badges seeded.`);
}

seedAvalancheL1Badges()
  .catch((e) => {
    console.error("Error seeding Avalanche L1 badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
