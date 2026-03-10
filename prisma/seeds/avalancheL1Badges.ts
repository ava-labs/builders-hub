import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface BadgeRequirement {
  id: string;
  type: string;
  points: number;
  unlocked: boolean;
  course_id: string;
  hackathon: string | null;
  description: string;
}

interface NewBadge {
  id: string;
  name: string;
  description: string;
  image_path: string;
  category: string;
  requirements: BadgeRequirement[];
}

// Badge IDs to delete — courses no longer in Avalanche L1 academy
const BADGES_TO_DELETE = [
  "1avalancheL1Academy-1blockchain-fundamentals",
  "1avalancheL1Academy-4interchain-token-transfer",
];

// Existing badges — only update image URL, keep everything else
const imageUpdates: { id: string; image_path: string }[] = [
  {
    id: "1avalancheL1Academy-2avalanche-fundamentals",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Avalanche_Fundamentals_Badge.png",
  },
  {
    id: "1avalancheL1Academy-3interchain-messaging",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/ICM_Badge.png",
  },
];

// New badges to create
const newBadges: NewBadge[] = [
  {
    id: "1avalancheL1Academy-5customizing-evm",
    name: "Customizing the EVM",
    description: "Successfully completed the Customizing the EVM course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Customizing_EVM_Badge.png",
    category: "academy",
    requirements: [
      { id: "customizing-evm", type: "course", points: 100, unlocked: false, course_id: "customizing-evm", hackathon: null, description: "Complete the Customizing the EVM course" },
    ],
  },
  {
    id: "1avalancheL1Academy-6erc20-bridge",
    name: "ERC-20 Bridge",
    description: "Successfully completed the ERC-20 Bridge course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/ERC20_Bridge_Badge.png",
    category: "academy",
    requirements: [
      { id: "erc20-bridge", type: "course", points: 100, unlocked: false, course_id: "erc20-bridge", hackathon: null, description: "Complete the ERC-20 Bridge course" },
    ],
  },
  {
    id: "1avalancheL1Academy-7native-token-bridge",
    name: "Native Token Bridge",
    description: "Successfully completed the Native Token Bridge course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Native_Token_Bridge.png",
    category: "academy",
    requirements: [
      { id: "native-token-bridge", type: "course", points: 100, unlocked: false, course_id: "native-token-bridge", hackathon: null, description: "Complete the Native Token Bridge course" },
    ],
  },
  {
    id: "1avalancheL1Academy-8l1-native-tokenomics",
    name: "L1 Native Tokenomics",
    description: "Successfully completed the L1 Native Tokenomics course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/L1_Native_Tokenomics_Badge.png",
    category: "academy",
    requirements: [
      { id: "l1-native-tokenomics", type: "course", points: 100, unlocked: false, course_id: "l1-native-tokenomics", hackathon: null, description: "Complete the L1 Native Tokenomics course" },
    ],
  },
  {
    id: "1avalancheL1Academy-9permissioned-l1s",
    name: "Permissioned L1s",
    description: "Successfully completed the Permissioned L1s course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Permissioned_L1s_Badge.png",
    category: "academy",
    requirements: [
      { id: "permissioned-l1s", type: "course", points: 100, unlocked: false, course_id: "permissioned-l1s", hackathon: null, description: "Complete the Permissioned L1s course" },
    ],
  },
  {
    id: "1avalancheL1Academy-10permissionless-l1s",
    name: "Permissionless L1s",
    description: "Successfully completed the Permissionless L1s course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Permissionless_L1s_Badge.png",
    category: "academy",
    requirements: [
      { id: "permissionless-l1s", type: "course", points: 100, unlocked: false, course_id: "permissionless-l1s", hackathon: null, description: "Complete the Permissionless L1s course" },
    ],
  },
  {
    id: "1avalancheL1Academy-11access-restriction",
    name: "Access Restriction",
    description: "Successfully completed the Access Restriction course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Access_Restriction_Badge.png",
    category: "academy",
    requirements: [
      { id: "access-restriction", type: "course", points: 100, unlocked: false, course_id: "access-restriction", hackathon: null, description: "Complete the Access Restriction course" },
    ],
  },
  // Full-completion badge — awarded when ALL 9 Avalanche L1 courses completed
  {
    id: "1avalancheL1Academy-12academy-full-completion",
    name: "Avalanche L1 Academy Graduate",
    description: "Successfully completed all Avalanche L1 Academy courses",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Avalanche_L1_Academy_Badge.png",
    category: "academy",
    requirements: [
      { id: "avalanche-fundamentals", type: "course", points: 100, unlocked: false, course_id: "avalanche-fundamentals", hackathon: null, description: "Complete the Avalanche Fundamentals course" },
      { id: "interchain-messaging", type: "course", points: 100, unlocked: false, course_id: "interchain-messaging", hackathon: null, description: "Complete the Interchain Messaging course" },
      { id: "customizing-evm", type: "course", points: 100, unlocked: false, course_id: "customizing-evm", hackathon: null, description: "Complete the Customizing the EVM course" },
      { id: "erc20-bridge", type: "course", points: 100, unlocked: false, course_id: "erc20-bridge", hackathon: null, description: "Complete the ERC-20 Bridge course" },
      { id: "native-token-bridge", type: "course", points: 100, unlocked: false, course_id: "native-token-bridge", hackathon: null, description: "Complete the Native Token Bridge course" },
      { id: "l1-native-tokenomics", type: "course", points: 100, unlocked: false, course_id: "l1-native-tokenomics", hackathon: null, description: "Complete the L1 Native Tokenomics course" },
      { id: "permissioned-l1s", type: "course", points: 100, unlocked: false, course_id: "permissioned-l1s", hackathon: null, description: "Complete the Permissioned L1s course" },
      { id: "permissionless-l1s", type: "course", points: 100, unlocked: false, course_id: "permissionless-l1s", hackathon: null, description: "Complete the Permissionless L1s course" },
      { id: "access-restriction", type: "course", points: 100, unlocked: false, course_id: "access-restriction", hackathon: null, description: "Complete the Access Restriction course" },
    ],
  },
];

async function seedAvalancheL1Badges() {
  console.log("Seeding Avalanche L1 academy badges...");

  // Step 1: Delete obsolete badges and their user associations
  for (const badgeId of BADGES_TO_DELETE) {
    const existing = await prisma.badge.findUnique({ where: { id: badgeId } });
    if (existing) {
      await prisma.userBadge.deleteMany({ where: { badge_id: badgeId } });
      await prisma.badge.delete({ where: { id: badgeId } });
      console.log(`  Deleted: ${existing.name} (${badgeId})`);
    } else {
      console.log(`  Skipped (not found): ${badgeId}`);
    }
  }

  // Step 2: Update image URLs for existing badges
  for (const { id, image_path } of imageUpdates) {
    const existing = await prisma.badge.findUnique({ where: { id } });
    if (existing) {
      await prisma.badge.update({
        where: { id },
        data: { image_path },
      });
      console.log(`  Updated image: ${existing.name}`);
    } else {
      console.log(`  Skipped (not found): ${id}`);
    }
  }

  // Step 3: Create new badges
  for (const badge of newBadges) {
    const existing = await prisma.badge.findUnique({ where: { id: badge.id } });
    if (existing) {
      console.log(`  Already exists: ${badge.name}`);
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

  console.log(`Done. Deleted ${BADGES_TO_DELETE.length}, updated ${imageUpdates.length} images, created ${newBadges.length} new badges.`);
}

seedAvalancheL1Badges()
  .catch((e) => {
    console.error("Error seeding Avalanche L1 badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
