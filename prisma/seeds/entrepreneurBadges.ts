import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface EntrepreneurBadgeSeed {
  id: string;
  name: string;
  description: string;
  image_path: string;
  category: string;
  requirements: { id: string; course_id: string; type: string; description: string; unlocked: boolean }[];
}

const entrepreneurBadges: EntrepreneurBadgeSeed[] = [
  {
    id: "entrepreneuracademy-foundations-web3-venture",
    name: "Foundations of a Web3 Venture",
    description: "Completed the Foundations of a Web3 Venture course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Foundations_Web3_Venture_Badge.png",
    category: "academy",
    requirements: [
      { id: "foundations-web3-venture-complete", course_id: "foundations-web3-venture", type: "course", description: "Complete Foundations of a Web3 Venture", unlocked: false },
    ],
  },
  {
    id: "entrepreneuracademy-go-to-market",
    name: "Go-to-Market Strategist",
    description: "Completed the Go-to-Market Strategist course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Go_To_Market_Badge.png",
    category: "academy",
    requirements: [
      { id: "go-to-market-complete", course_id: "go-to-market", type: "course", description: "Complete Go-to-Market Strategist", unlocked: false },
    ],
  },
  {
    id: "entrepreneuracademy-web3-community-architect",
    name: "Web3 Community Architect",
    description: "Completed the Web3 Community Architect course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Community_Architect_Badge.png",
    category: "academy",
    requirements: [
      { id: "web3-community-architect-complete", course_id: "web3-community-architect", type: "course", description: "Complete Web3 Community Architect", unlocked: false },
    ],
  },
  {
    id: "entrepreneuracademy-fundraising-finance",
    name: "Fundraising & Finance Pro",
    description: "Completed the Fundraising & Finance Pro course",
    image_path: "https://qizat5l3bwvomkny.public.blob.vercel-storage.com/academy_badges/Entrepreneur/Fundraising_Badge.png",
    category: "academy",
    requirements: [
      { id: "fundraising-finance-complete", course_id: "fundraising-finance", type: "course", description: "Complete Fundraising & Finance Pro", unlocked: false },
    ],
  },
];

async function seedEntrepreneurBadges() {
  console.log("Seeding entrepreneur academy badges...");

  for (const badge of entrepreneurBadges) {
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

  console.log(`Done. ${entrepreneurBadges.length} entrepreneur academy badges seeded.`);
}

seedEntrepreneurBadges()
  .catch((e) => {
    console.error("Error seeding entrepreneur badges:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
