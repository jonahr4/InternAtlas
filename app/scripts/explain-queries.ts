import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function explainQueries() {
  console.log('🔍 Query Execution Plans\n');
  console.log('=' .repeat(80));

  // Query 1: Count all
  console.log('\n1. COUNT ALL JOBS:');
  const plan1 = await prisma.$queryRaw`
    EXPLAIN ANALYZE
    SELECT COUNT(*) FROM "Job";
  `;
  console.log(plan1);

  // Query 2: Count with status filter
  console.log('\n\n2. COUNT ACTIVE JOBS (with status filter):');
  const plan2 = await prisma.$queryRaw`
    EXPLAIN ANALYZE
    SELECT COUNT(*) FROM "Job" WHERE status = 'ACTIVE';
  `;
  console.log(plan2);

  // Query 3: Title search
  console.log('\n\n3. TITLE SEARCH (ILIKE):');
  const plan3 = await prisma.$queryRaw`
    EXPLAIN ANALYZE
    SELECT COUNT(*) FROM "Job" WHERE title ILIKE '%software%';
  `;
  console.log(plan3);

  // Query 4: Better approach - with LIMIT
  console.log('\n\n4. FIND MANY WITH LIMIT (better for app):');
  const plan4 = await prisma.$queryRaw`
    EXPLAIN ANALYZE
    SELECT * FROM "Job" 
    WHERE status = 'ACTIVE' 
    ORDER BY "postedAt" DESC 
    LIMIT 25;
  `;
  console.log(plan4);

  await prisma.$disconnect();
}

explainQueries().catch(console.error);
