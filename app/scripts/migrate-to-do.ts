import { PrismaClient, Prisma } from '@prisma/client';

// Source: Local DB
const sourceDB = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/internatlas',
    },
  },
});

// Target: Digital Ocean DB
const targetDB = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DO_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

async function migrate() {
  try {
    console.log('🔄 Starting migration from local to Digital Ocean...\n');

    // Fetch all companies
    console.log('📦 Fetching companies from local DB...');
    const companies = await sourceDB.company.findMany({
      orderBy: { id: 'asc' },
    });
    console.log(`✅ Found ${companies.length} companies\n`);

    // Insert companies in batches
    console.log('💾 Inserting companies to Digital Ocean...');
    const batchSize = 100;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize);
      await targetDB.company.createMany({
        data: batch,
        skipDuplicates: true,
      });
      console.log(
        `   Inserted ${Math.min(i + batchSize, companies.length)}/${companies.length} companies`
      );
    }
    console.log('✅ Companies migrated\n');

    // Fetch all jobs
    console.log('📦 Fetching jobs from local DB...');
    const jobs = await sourceDB.job.findMany({
      orderBy: { id: 'asc' },
    });
    console.log(`✅ Found ${jobs.length} jobs\n`);

    // Insert jobs in batches
    console.log('💾 Inserting jobs to Digital Ocean...');
    const jobBatchSize = 500;
    for (let i = 0; i < jobs.length; i += jobBatchSize) {
      const batch = jobs.slice(i, i + jobBatchSize).map(job => ({
        ...job,
        rawPayload: job.rawPayload === null ? Prisma.JsonNull : job.rawPayload,
      }));
      try {
        await targetDB.job.createMany({
          data: batch,
          skipDuplicates: true,
        });
        console.log(
          `   Inserted ${Math.min(i + jobBatchSize, jobs.length)}/${jobs.length} jobs`
        );
      } catch (error) {
        console.warn(`   ⚠️  Batch ${i}-${i + jobBatchSize} had errors, continuing...`);
      }
    }
    console.log('✅ Jobs migrated\n');

    // Verify counts
    const targetCompanyCount = await targetDB.company.count();
    const targetJobCount = await targetDB.job.count();

    console.log('📊 Migration Summary:');
    console.log(`   Source: ${companies.length} companies, ${jobs.length} jobs`);
    console.log(`   Target: ${targetCompanyCount} companies, ${targetJobCount} jobs`);

    if (
      targetCompanyCount === companies.length &&
      targetJobCount === jobs.length
    ) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with differences');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sourceDB.$disconnect();
    await targetDB.$disconnect();
  }
}

migrate();
