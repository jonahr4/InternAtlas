import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS "Job_status_idx" ON "Job"("status")',
    'CREATE INDEX IF NOT EXISTS "Job_postedAt_idx" ON "Job"("postedAt")',
    'CREATE INDEX IF NOT EXISTS "Job_lastSeenAt_idx" ON "Job"("lastSeenAt")',
    'CREATE INDEX IF NOT EXISTS "Job_createdAt_idx" ON "Job"("createdAt")',
    'CREATE INDEX IF NOT EXISTS "Job_employmentType_idx" ON "Job"("employmentType")',
    'CREATE INDEX IF NOT EXISTS "Job_locationType_idx" ON "Job"("locationType")',
    'CREATE INDEX IF NOT EXISTS "Job_sourcePlatform_idx" ON "Job"("sourcePlatform")',
    'CREATE INDEX IF NOT EXISTS "Job_title_idx" ON "Job"("title")',
    'CREATE INDEX IF NOT EXISTS "Job_location_idx" ON "Job"("location")',
    'CREATE INDEX IF NOT EXISTS "Job_status_postedAt_idx" ON "Job"("status", "postedAt")',
    'CREATE INDEX IF NOT EXISTS "Job_status_lastSeenAt_idx" ON "Job"("status", "lastSeenAt")',
    'CREATE INDEX IF NOT EXISTS "Job_status_createdAt_idx" ON "Job"("status", "createdAt")',
    'CREATE INDEX IF NOT EXISTS "Job_employmentType_postedAt_idx" ON "Job"("employmentType", "postedAt")',
    'CREATE INDEX IF NOT EXISTS "Job_companyId_postedAt_idx" ON "Job"("companyId", "postedAt")',
  ];

  for (const sql of indexes) {
    try {
      console.log(`Creating: ${sql.split(' ON ')[0]}...`);
      await prisma.$executeRawUnsafe(sql);
      console.log('✓ Created');
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log('✓ Already exists');
      } else {
        console.error('✗ Error:', error.message);
      }
    }
  }

  // Show all indexes
  console.log('\nAll indexes on Job table:');
  const result = await prisma.$queryRaw`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'Job' 
    ORDER BY indexname
  ` as Array<{ indexname: string }>;
  
  result.forEach(row => console.log(`  - ${row.indexname}`));
  
  await prisma.$disconnect();
}

addIndexes().catch(console.error);
