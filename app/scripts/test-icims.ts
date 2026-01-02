import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check for any companies with appliedsystems
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { name: { contains: 'Applied', mode: 'insensitive' } },
        { boardUrl: { contains: 'appliedsystems', mode: 'insensitive' } }
      ]
    }
  });
  
  console.log('Found companies:', JSON.stringify(companies, null, 2));
  
  // Also check what the extracted name would be
  const testUrl = 'https://careers-appliedsystems.icims.com/jobs/7034/software-engineer---sr-software-engineer/job';
  const url = new URL(testUrl);
  const host = url.hostname;
  const firstLabel = host.split(".")[0] ?? "";
  const cleanedLabel = firstLabel
    .replace(/^careers-?/i, "")
    .replace(/-careers$/i, "")
    .trim();
  const nameSlug = cleanedLabel || firstLabel || host;
  const name = nameSlug
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
  const boardUrl = `${url.protocol}//${host}/jobs/search?ss=1`;
  
  console.log('\nExtracted data:');
  console.log('Name:', name);
  console.log('Board URL:', boardUrl);
  
  // Try to create the company
  try {
    console.log('\nAttempting to create company...');
    const company = await prisma.company.create({
      data: { name, boardUrl, platform: 'ICIMS' as any },
    });
    console.log('Success! Created:', company);
  } catch (error) {
    console.error('Failed to create company:', error);
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
