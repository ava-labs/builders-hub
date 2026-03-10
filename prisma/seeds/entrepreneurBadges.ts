import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Only updating image URLs — no structural changes
const imageUpdates: { id: string; image_path: string }[] = [
  {
    id: "3entrepreneurAcademy-1foundations-web3-venture",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Foundations_Web3_Venture_Badge.png",
  },
  {
    id: "3entrepreneurAcademy-2fundraising-finance",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Fundraising_Badge.png",
  },
  {
    id: "3entrepreneurAcademy-3go-to-market",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Go_To_Market_Badge.png",
  },
  {
    id: "3entrepreneurAcademy-4web3-community-architect",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Community_Architect_Badge.png",
  },
  {
    id: "3entrepreneurAcademy-5academy-full-completion",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur_Academy_Badge.png",
  },
];

async function updateEntrepreneurBadgeImages() {
  console.log("Updating entrepreneur academy badge images...");

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

  console.log(`Done. ${imageUpdates.length} entrepreneur badge images updated.`);
}

updateEntrepreneurBadgeImages()
  .catch((e) => {
    console.error("Error updating entrepreneur badge images:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
