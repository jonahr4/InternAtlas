import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query'],
});

interface BenchmarkResult {
  name: string;
  time: number;
  rowCount: number;
  success: boolean;
  error?: string;
}

async function benchmark(name: string, fn: () => Promise<any>): Promise<BenchmarkResult> {
  console.log(`\n🔄 Running: ${name}`);
  const start = Date.now();
  try {
    const result = await fn();
    const time = Date.now() - start;
    const rowCount = Array.isArray(result) ? result.length : result?.count ?? 0;
    console.log(`✅ Completed in ${time}ms (${rowCount} rows)`);
    return { name, time, rowCount, success: true };
  } catch (error: any) {
    const time = Date.now() - start;
    console.error(`❌ Failed after ${time}ms:`, error.message);
    return { name, time, rowCount: 0, success: false, error: error.message };
  }
}

async function runBenchmarks() {
  console.log('🚀 Database Performance Benchmarks');
  console.log('==================================\n');
  
  const results: BenchmarkResult[] = [];

  // Test 1: Simple count (no filters)
  results.push(await benchmark(
    'Count all jobs',
    () => prisma.job.count()
  ));

  // Test 2: Filter by status (uses index: Job_status_idx)
  results.push(await benchmark(
    'Count active jobs (status filter)',
    () => prisma.job.count({ where: { status: 'ACTIVE' } })
  ));

  // Test 3: Filter by employment type (uses index: Job_employmentType_idx)
  results.push(await benchmark(
    'Count internships (employmentType filter)',
    () => prisma.job.count({ where: { employmentType: 'INTERN' } })
  ));

  // Test 4: Composite filter - status + postedAt (uses index: Job_status_postedAt_idx)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  results.push(await benchmark(
    'Count active jobs posted in last 30 days (composite index)',
    () => prisma.job.count({
      where: {
        status: 'ACTIVE',
        postedAt: { gte: thirtyDaysAgo }
      }
    })
  ));

  // Test 5: Title search (uses index: Job_title_idx)
  results.push(await benchmark(
    'Search jobs by title containing "software"',
    () => prisma.job.count({
      where: {
        title: { contains: 'software', mode: 'insensitive' }
      }
    })
  ));

  // Test 6: Complex multi-filter (similar to custom tables)
  results.push(await benchmark(
    'Complex filter: active internships with title search, sorted',
    () => prisma.job.findMany({
      where: {
        AND: [
          { status: 'ACTIVE' },
          { employmentType: 'INTERN' },
          { title: { contains: 'engineer', mode: 'insensitive' } }
        ]
      },
      orderBy: { postedAt: 'desc' },
      take: 25,
      include: { company: true }
    })
  ));

  // Test 7: Paginated query with skip (tests index efficiency)
  results.push(await benchmark(
    'Paginated query: page 10 of active jobs',
    () => prisma.job.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { postedAt: 'desc' },
      take: 25,
      skip: 225,
      include: { company: true }
    })
  ));

  // Test 8: NEW jobs calculation (48 hours)
  results.push(await benchmark(
    'Calculate NEW jobs (created in last 48 hours)',
    () => {
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
      return prisma.job.count({
        where: {
          AND: [
            { status: 'ACTIVE' },
            { employmentType: 'INTERN' },
            { createdAt: { gte: fortyEightHoursAgo } }
          ]
        }
      });
    }
  ));

  // Summary
  console.log('\n\n📊 BENCHMARK SUMMARY');
  console.log('===================\n');
  
  const successfulTests = results.filter(r => r.success);
  const failedTests = results.filter(r => !r.success);
  
  console.log(`Total tests: ${results.length}`);
  console.log(`Passed: ${successfulTests.length}`);
  console.log(`Failed: ${failedTests.length}\n`);

  if (successfulTests.length > 0) {
    console.log('Performance Results:');
    console.log('-------------------');
    successfulTests.forEach((result) => {
      const emoji = result.time < 100 ? '🟢' : result.time < 500 ? '🟡' : '🔴';
      console.log(`${emoji} ${result.name}`);
      console.log(`   Time: ${result.time}ms | Rows: ${result.rowCount}`);
    });

    const avgTime = successfulTests.reduce((sum, r) => sum + r.time, 0) / successfulTests.length;
    const maxTime = Math.max(...successfulTests.map(r => r.time));
    const minTime = Math.min(...successfulTests.map(r => r.time));

    console.log('\n📈 Statistics:');
    console.log(`   Average: ${avgTime.toFixed(2)}ms`);
    console.log(`   Min: ${minTime}ms`);
    console.log(`   Max: ${maxTime}ms`);

    console.log('\n🎯 Performance Rating:');
    if (avgTime < 200) {
      console.log('   ✅ EXCELLENT - Queries are very fast!');
    } else if (avgTime < 500) {
      console.log('   ✅ GOOD - Queries are reasonably fast');
    } else if (avgTime < 1000) {
      console.log('   ⚠️  MODERATE - Some optimization may help');
    } else {
      console.log('   ❌ SLOW - Database needs optimization (check indexes)');
    }
  }

  if (failedTests.length > 0) {
    console.log('\n\n❌ Failed Tests:');
    failedTests.forEach(result => {
      console.log(`   - ${result.name}: ${result.error}`);
    });
  }

  await prisma.$disconnect();
}

runBenchmarks().catch(console.error);
