import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { CategoryType } from "../src/generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const categories: { name: string; type: CategoryType }[] = [
  { name: "Electronics", type: CategoryType.product },
  { name: "Vehicles", type: CategoryType.product },
  { name: "Property", type: CategoryType.product },
  { name: "Fashion & Beauty", type: CategoryType.product },
  { name: "Home & Furniture", type: CategoryType.product },
  { name: "Jobs", type: CategoryType.service },
  { name: "Services", type: CategoryType.service },
  { name: "Animals & Pets", type: CategoryType.product },
  { name: "Sports & Hobbies", type: CategoryType.product },
  { name: "Kids & Baby", type: CategoryType.product },
  { name: "Books & Education", type: CategoryType.product },
  { name: "Business & Industrial", type: CategoryType.product },
  { name: "Health & Medical", type: CategoryType.service },
  { name: "Food & Grocery", type: CategoryType.product },
  { name: "Community", type: CategoryType.service },
];

async function main() {
  for (const [index, category] of categories.entries()) {
    const existing = await prisma.category.findFirst({
      where: { name: { path: ["en"], equals: category.name } },
    });

    if (existing) {
      console.log(`Skipping "${category.name}" (already exists)`);
      continue;
    }

    await prisma.category.create({
      data: {
        name: { en: category.name, ur: category.name },
        type: category.type,
        sortNumber: index,
      },
    });

    console.log(`Created "${category.name}" (${category.type})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
