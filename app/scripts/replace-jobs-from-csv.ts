import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import Papa from 'papaparse';

// Target: Digital Ocean DB
const db = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DO_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
});

function parseCSV(content: string) {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value, header) => {
      // Trim values and handle null/empty strings
      const trimmed = value.trim();
      if (trimmed === '' || trimmed === 'null' || trimmed === 'NULL') {
        return null;
      }
      // Parse dates for known date fields
      if (
        header === 'createdAt' ||
        header === 'updatedAt' ||
        header === 'postedAt' ||
        header === 'firstCrawledAt' ||
        header === 'firstSeenAt' ||
        header === 'lastSeenAt'
      ) {
        try {
          // Handle format: "2026-01-03 02:27:22.611" (without timezone)
          // Replace space with T to make it ISO-8601 compatible
          const isoString = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T') + 'Z';
          return new Date(isoString);
        } catch {
          return null;
        }
      }
      return trimmed;
    },
  });

  if (result.errors.length > 0) {
    console.warn('CSV parsing warnings:', result.errors);
  }

  return result.data;
}

async function replaceJobs() {
  try {
    console.log('🔄 Replacing Digital Ocean jobs with CSV data...\n');

    // Read CSV file
    console.log('📖 Reading CSV file...');
    const csvPath = join(process.cwd(), 'data', 'Job.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const jobs = parseCSV(csvContent);
    console.log(`✅ Parsed ${jobs.length} jobs from CSV\n`);

    // Delete all existing jobs
    console.log('🗑️  Deleting existing jobs from Digital Ocean...');
    const deleteResult = await db.job.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.count} jobs\n`);

    // Insert jobs in batches
    console.log('💾 Inserting jobs to Digital Ocean...');
    const batchSize = 250; // Reduced from 500 to avoid connection issues
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize) as any[];
      let retries = 3;
      let success = false;

      while (retries > 0 && !success) {
        try {
          await db.job.createMany({
            data: batch,
            skipDuplicates: true,
          });
          successCount += batch.length;
          success = true;
          console.log(
            `   Inserted ${Math.min(i + batchSize, jobs.length)}/${jobs.length} jobs`
          );
        } catch (error) {
          retries--;
          if (retries === 0) {
            errorCount += batch.length;
            console.warn(
              `   ⚠️  Batch ${i}-${i + batchSize} failed after retries`
            );
          } else {
            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
    }
    console.log('✅ Jobs replaced\n');

    // Verify count
    const finalCount = await db.job.count();
    console.log('📊 Final Summary:');
    console.log(`   CSV jobs: ${jobs.length}`);
    console.log(`   DO jobs: ${finalCount}`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);

    if (finalCount >= jobs.length * 0.95) {
      // Allow 5% margin for duplicates/errors
      console.log('\n✅ Replacement completed successfully!');
    } else {
      console.log('\n⚠️  Significant differences detected');
    }
  } catch (error) {
    console.error('❌ Replacement failed:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

replaceJobs();
