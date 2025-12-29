import { prisma } from "../src/lib/prisma";

async function main() {
  const result = await prisma.job.deleteMany({});
  console.log(`Deleted ${result.count} jobs.`);
}

main()
  .catch((error) => {
    console.error(`Clear jobs failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
