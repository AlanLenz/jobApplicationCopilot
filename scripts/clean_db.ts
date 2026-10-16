import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.job.deleteMany({
    where: {
      url: 'https://www.linkedin.com/jobs/search/',
    },
  });
  console.log(`Deleted ${result.count} bogus job entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

