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

// Original production DB state (4 badges):
//   1avalancheL1Academy-1blockchain-fundamentals  → DELETE (course moved to blockchain academy)
//   1avalancheL1Academy-2avalanche-fundamentals    → KEEP as ID -1 (renumber)
//   1avalancheL1Academy-3interchain-messaging      → KEEP as ID -4 (renumber)
//   1avalancheL1Academy-4interchain-token-transfer  → DELETE (course removed)

// Badge IDs to delete — courses no longer in Avalanche L1 academy
const BADGES_TO_DELETE = [
  "1avalancheL1Academy-1blockchain-fundamentals",
  "1avalancheL1Academy-4interchain-token-transfer",
];

// Existing badges that need their ID renumbered + image updated
// Uses create → migrate userBadges → delete pattern for FK safety
const idMigrations: { oldId: string; newId: string; image_path: string }[] = [
  {
    oldId: "1avalancheL1Academy-2avalanche-fundamentals",
    newId: "1avalancheL1Academy-1avalanche-fundamentals",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Avalanche_Fundamentals_Badge.png",
  },
  {
    oldId: "1avalancheL1Academy-3interchain-messaging",
    newId: "1avalancheL1Academy-4interchain-messaging",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/ICM_Badge.png",
  },
];

// New badges to create — numbered in correct course order
const newBadges: NewBadge[] = [
  {
    id: "1avalancheL1Academy-2permissioned-l1s",
    name: "Permissioned L1s",
    description: "Completed the Permissioned L1s course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Permissioned_L1s_Badge.png",
    category: "academy",
    requirements: [
      { id: "permissioned-l1s", type: "course", points: 100, unlocked: false, course_id: "permissioned-l1s", hackathon: null, description: "Complete the Permissioned L1s course" },
    ],
  },
  {
    id: "1avalancheL1Academy-3l1-native-tokenomics",
    name: "L1 Native Tokenomics",
    description: "Completed the L1 Native Tokenomics course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/L1_Native_Tokenomics_Badge.png",
    category: "academy",
    requirements: [
      { id: "l1-native-tokenomics", type: "course", points: 100, unlocked: false, course_id: "l1-native-tokenomics", hackathon: null, description: "Complete the L1 Native Tokenomics course" },
    ],
  },
  {
    id: "1avalancheL1Academy-5customizing-evm",
    name: "Customizing the EVM",
    description: "Completed the Customizing the EVM course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Customizing_EVM_Badge.png",
    category: "academy",
    requirements: [
      { id: "customizing-evm", type: "course", points: 100, unlocked: false, course_id: "customizing-evm", hackathon: null, description: "Complete the Customizing the EVM course" },
    ],
  },
  {
    id: "1avalancheL1Academy-6permissionless-l1s",
    name: "Permissionless L1s",
    description: "Completed the Permissionless L1s course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Permissionless_L1s_Badge.png",
    category: "academy",
    requirements: [
      { id: "permissionless-l1s", type: "course", points: 100, unlocked: false, course_id: "permissionless-l1s", hackathon: null, description: "Complete the Permissionless L1s course" },
    ],
  },
  {
    id: "1avalancheL1Academy-7erc20-bridge",
    name: "ERC-20 Bridge",
    description: "Completed the ERC-20 Bridge course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/ERC20_Bridge_Badge.png",
    category: "academy",
    requirements: [
      { id: "erc20-bridge", type: "course", points: 100, unlocked: false, course_id: "erc20-bridge", hackathon: null, description: "Complete the ERC-20 Bridge course" },
    ],
  },
  {
    id: "1avalancheL1Academy-8native-token-bridge",
    name: "Native Token Bridge",
    description: "Completed the Native Token Bridge course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Native_Token_Bridge.png",
    category: "academy",
    requirements: [
      { id: "native-token-bridge", type: "course", points: 100, unlocked: false, course_id: "native-token-bridge", hackathon: null, description: "Complete the Native Token Bridge course" },
    ],
  },
  {
    id: "1avalancheL1Academy-9access-restriction",
    name: "Access Restriction",
    description: "Completed the Access Restriction course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Access_Restriction_Badge.png",
    category: "academy",
    requirements: [
      { id: "access-restriction", type: "course", points: 100, unlocked: false, course_id: "access-restriction", hackathon: null, description: "Complete the Access Restriction course" },
    ],
  },
  {
    id: "1avalancheL1Academy-10academy-full-completion",
    name: "Avalanche L1 Academy Graduate",
    description: "Completed all Avalanche L1 Academy courses",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Avalanche%20L1/Avalanche_L1_Academy_Badge.png",
    category: "academy",
    requirements: [
      { id: "avalanche-fundamentals", type: "course", points: 100, unlocked: false, course_id: "avalanche-fundamentals", hackathon: null, description: "Complete the Avalanche Fundamentals course" },
      { id: "permissioned-l1s", type: "course", points: 100, unlocked: false, course_id: "permissioned-l1s", hackathon: null, description: "Complete the Permissioned L1s course" },
      { id: "l1-native-tokenomics", type: "course", points: 100, unlocked: false, course_id: "l1-native-tokenomics", hackathon: null, description: "Complete the L1 Native Tokenomics course" },
      { id: "interchain-messaging", type: "course", points: 100, unlocked: false, course_id: "interchain-messaging", hackathon: null, description: "Complete the Interchain Messaging course" },
      { id: "customizing-evm", type: "course", points: 100, unlocked: false, course_id: "customizing-evm", hackathon: null, description: "Complete the Customizing the EVM course" },
      { id: "permissionless-l1s", type: "course", points: 100, unlocked: false, course_id: "permissionless-l1s", hackathon: null, description: "Complete the Permissionless L1s course" },
      { id: "erc20-bridge", type: "course", points: 100, unlocked: false, course_id: "erc20-bridge", hackathon: null, description: "Complete the ERC-20 Bridge course" },
      { id: "native-token-bridge", type: "course", points: 100, unlocked: false, course_id: "native-token-bridge", hackathon: null, description: "Complete the Native Token Bridge course" },
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
      console.log(`  Skipped delete (not found): ${badgeId}`);
    }
  }

  // Step 2: Migrate existing badges to new IDs + update images
  // Pattern: create new badge → migrate userBadge FKs → delete old badge
  for (const { oldId, newId, image_path } of idMigrations) {
    const existing = await prisma.badge.findUnique({ where: { id: oldId } });
    if (existing) {
      await prisma.badge.create({
        data: {
          id: newId,
          name: existing.name,
          description: `Completed the ${existing.name} course`,
          image_path: image_path,
          category: existing.category,
          requirements: existing.requirements as any,
          current_version: existing.current_version,
        },
      });
      await prisma.userBadge.updateMany({
        where: { badge_id: oldId },
        data: { badge_id: newId },
      });
      await prisma.badge.delete({ where: { id: oldId } });
      console.log(`  Migrated: ${existing.name} (${oldId} → ${newId})`);
    } else {
      // Check if already migrated (idempotent)
      const already = await prisma.badge.findUnique({ where: { id: newId } });
      if (already) {
        await prisma.badge.update({
          where: { id: newId },
          data: { image_path, description: `Completed the ${already.name} course` },
        });
        console.log(`  Updated (already migrated): ${already.name}`);
      } else {
        console.log(`  Skipped migrate (not found): ${oldId}`);
      }
    }
  }

  // Step 3: Create new badges (idempotent — updates image + description if exists)
  for (const badge of newBadges) {
    const existing = await prisma.badge.findUnique({ where: { id: badge.id } });
    if (existing) {
      await prisma.badge.update({
        where: { id: badge.id },
        data: { image_path: badge.image_path, description: badge.description },
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
          requirements: badge.requirements as any,
        },
      });
      console.log(`  Created: ${badge.name}`);
    }
  }

  console.log("Done.");
}

seedAvalancheL1Badges()
  .catch((e) => {
    console.error("Error seeding Avalanche L1 badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
