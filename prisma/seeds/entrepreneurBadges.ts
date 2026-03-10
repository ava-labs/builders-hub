import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Only updating image URLs — no structural changes
const imageUpdates: { id: string; image_path: string }[] = [
  {
    id: "3entrepreneurAcademy-1foundations-web3-venture",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Foundations_Web3_Venture_Badge.png",
  },
  {
    id: "3entrepreneurAcademy-3go-to-market",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Go_To_Market_Badge.png",
  },
  {
    id: "3entrepreneurAcademy-4web3-community-architect",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Community_Architect_Badge.png",
  },
];

// These two IDs have a trailing newline embedded in the DB — fix the IDs and update images
const brokenIdUpdates: { brokenId: string; fixedId: string; image_path: string }[] = [
  {
    brokenId: "3entrepreneurAcademy-2fundraising-finance\n\n",
    fixedId: "3entrepreneurAcademy-2fundraising-finance",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Fundraising_Badge.png",
  },
  {
    brokenId: "3entrepreneurAcademy-5academy-full-completion\n\n",
    fixedId: "3entrepreneurAcademy-5academy-full-completion",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur_Academy_Badge.png",
  },
];

async function updateEntrepreneurBadgeImages() {
  console.log("Updating entrepreneur academy badge images...");

  // Step 1: Fix broken IDs (trailing newlines) and update images
  for (const { brokenId, fixedId, image_path } of brokenIdUpdates) {
    const existing = await prisma.badge.findUnique({ where: { id: brokenId } });
    if (existing) {
      // 1. Create new badge with clean ID first (so FK target exists)
      await prisma.badge.create({
        data: {
          id: fixedId,
          name: existing.name,
          description: existing.description,
          image_path: image_path,
          category: existing.category,
          requirements: existing.requirements,
          current_version: existing.current_version,
        },
      });
      // 2. Migrate userBadge references to clean ID
      await prisma.userBadge.updateMany({
        where: { badge_id: brokenId },
        data: { badge_id: fixedId },
      });
      // 3. Delete the broken record
      await prisma.badge.delete({ where: { id: brokenId } });
      console.log(`  Fixed ID + updated image: ${existing.name}`);
    } else {
      // Try the clean ID in case it was already fixed
      const clean = await prisma.badge.findUnique({ where: { id: fixedId } });
      if (clean) {
        await prisma.badge.update({
          where: { id: fixedId },
          data: { image_path },
        });
        console.log(`  Updated (already clean): ${clean.name}`);
      } else {
        console.log(`  Skipped (not found): ${fixedId}`);
      }
    }
  }

  // Step 2: Update clean IDs
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

  console.log("Done. Entrepreneur badge images updated.");
}

updateEntrepreneurBadgeImages()
  .catch((e) => {
    console.error("Error updating entrepreneur badge images:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
