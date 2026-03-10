import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Original production DB state (5 badges):
//   3entrepreneurAcademy-1foundations-web3-venture       → clean ID, update image + description
//   3entrepreneurAcademy-2fundraising-finance\n\n        → BROKEN ID (trailing 0a0a), fix + update
//   3entrepreneurAcademy-3go-to-market                   → clean ID, update image + description
//   3entrepreneurAcademy-4web3-community-architect        → clean ID, update image + description
//   3entrepreneurAcademy-5academy-full-completion\n\n     → BROKEN ID (trailing 0a0a), fix + update

// Clean IDs — only update image + description
const cleanUpdates: { id: string; image_path: string; description: string }[] = [
  {
    id: "3entrepreneurAcademy-1foundations-web3-venture",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Foundations_Web3_Venture_Badge.png",
    description: "Completed the Foundations of a Web3 Venture course",
  },
  {
    id: "3entrepreneurAcademy-3go-to-market",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Go_To_Market_Badge.png",
    description: "Completed the Go-to-Market Strategy course",
  },
  {
    id: "3entrepreneurAcademy-4web3-community-architect",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Community_Architect_Badge.png",
    description: "Completed the Web3 Community Architect course",
  },
];

// Broken IDs with trailing \n\n — fix via create → migrate → delete pattern
const brokenIdUpdates: { brokenId: string; fixedId: string; image_path: string; description: string }[] = [
  {
    brokenId: "3entrepreneurAcademy-2fundraising-finance\n\n",
    fixedId: "3entrepreneurAcademy-2fundraising-finance",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Fundraising_Badge.png",
    description: "Completed the Fundraising & Finance course",
  },
  {
    brokenId: "3entrepreneurAcademy-5academy-full-completion\n\n",
    fixedId: "3entrepreneurAcademy-5academy-full-completion",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur_Academy_Badge.png",
    description: "Completed all Entrepreneur Academy courses",
  },
];

async function updateEntrepreneurBadges() {
  console.log("Updating entrepreneur academy badges...");

  // Step 1: Fix broken IDs (trailing newlines) + update image + description
  for (const { brokenId, fixedId, image_path, description } of brokenIdUpdates) {
    const existing = await prisma.badge.findUnique({ where: { id: brokenId } });
    if (existing) {
      await prisma.badge.create({
        data: {
          id: fixedId,
          name: existing.name,
          description: description,
          image_path: image_path,
          category: existing.category,
          requirements: existing.requirements,
          current_version: existing.current_version,
        },
      });
      await prisma.userBadge.updateMany({
        where: { badge_id: brokenId },
        data: { badge_id: fixedId },
      });
      await prisma.badge.delete({ where: { id: brokenId } });
      console.log(`  Fixed ID + updated: ${existing.name}`);
    } else {
      // Already fixed — just update image + description
      const clean = await prisma.badge.findUnique({ where: { id: fixedId } });
      if (clean) {
        await prisma.badge.update({
          where: { id: fixedId },
          data: { image_path, description },
        });
        console.log(`  Updated (already clean): ${clean.name}`);
      } else {
        console.log(`  Skipped (not found): ${fixedId}`);
      }
    }
  }

  // Step 2: Update clean IDs — image + description
  for (const { id, image_path, description } of cleanUpdates) {
    const existing = await prisma.badge.findUnique({ where: { id } });
    if (existing) {
      await prisma.badge.update({
        where: { id },
        data: { image_path, description },
      });
      console.log(`  Updated: ${existing.name}`);
    } else {
      console.log(`  Skipped (not found): ${id}`);
    }
  }

  console.log("Done.");
}

updateEntrepreneurBadges()
  .catch((e) => {
    console.error("Error updating entrepreneur badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
