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
      // Parse dates
      if (header === 'createdAt' || header === 'updatedAt' || header === 'firstCrawledAt') {
        try {
          return new Date(trimmed);
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

async function replaceCompanies() {
  try {
    console.log('🔄 Replacing Digital Ocean companies with CSV data...\n');

    // Read CSV file
    console.log('📖 Reading CSV file...');
    const csvPath = join(process.cwd(), 'data', 'Company.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const companies = parseCSV(csvContent);
    console.log(`✅ Parsed ${companies.length} companies from CSV\n`);

    // Delete all existing companies
    console.log('🗑️  Deleting existing companies from Digital Ocean...');
    const deleteResult = await db.company.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.count} companies\n`);

    // Insert companies in batches
    console.log('💾 Inserting companies to Digital Ocean...');
    const batchSize = 100;
    for (let i = 0; i < companies.length; i += batchSize) {
      const batch = companies.slice(i, i + batchSize) as any[];
      await db.company.createMany({
        data: batch,
      });
      console.log(
        `   Inserted ${Math.min(i + batchSize, companies.length)}/${companies.length} companies`
      );
    }
    console.log('✅ Companies replaced\n');

    // Verify count
    const finalCount = await db.company.count();
    console.log('📊 Final Summary:');
    console.log(`   CSV companies: ${companies.length}`);
    console.log(`   DO companies: ${finalCount}`);

    if (finalCount === companies.length) {
      console.log('\n✅ Replacement completed successfully!');
    } else {
      console.log('\n⚠️  Count mismatch!');
    }
  } catch (error) {
    console.error('❌ Replacement failed:', error);
    throw error;
  } finally {
    await db.$disconnect();
  }
}

replaceCompanies();
