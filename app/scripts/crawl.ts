import { prisma } from "../src/lib/prisma";

type GreenhouseJob = {
  id: number;
  title: string;
  location: { name: string };
  absolute_url: string;
  created_at: string;
  updated_at: string;
  content?: string;
};

type Company = {
  name: string;
  platform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "CUSTOM";
  boardUrl: string;
};

function getGreenhouseSlug(boardUrl: string): string {
  const url = new URL(boardUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Invalid Greenhouse board URL: ${boardUrl}`);
  }
  return parts[0];
}

async function fetchGreenhouseJobs(boardUrl: string): Promise<GreenhouseJob[]> {
  const slug = getGreenhouseSlug(boardUrl);
  const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(apiUrl);

  if (!res.ok) {
    throw new Error(`Failed to fetch ${apiUrl}: ${res.status}`);
  }

  const data = (await res.json()) as { jobs: GreenhouseJob[] };
  return data.jobs ?? [];
}

function normalizeGreenhouseJob(
  companyName: string,
  job: GreenhouseJob
): NormalizedJob {
  return {
    companyName,
    title: job.title,
    location: job.location?.name ?? null,
    postedAt: job.created_at ?? null,
    jobUrl: job.absolute_url,
    descriptionText: job.content ?? null,
  };
}

async function main() {
  const companies = (await prisma.company.findMany({
    select: { name: true, platform: true, boardUrl: true },
  })) as Company[];
  const greenhouseCompanies = companies.filter(
    (company) => company.platform === "GREENHOUSE"
  );

  if (greenhouseCompanies.length === 0) {
    console.log("No Greenhouse companies found.");
    return;
  }

  let totalJobs = 0;
  let totalWorking = 0;
  let totalBroken = 0;

  for (const company of greenhouseCompanies) {
    try {
      const jobs = await fetchGreenhouseJobs(company.boardUrl);
      const normalized = jobs.map((job) => normalizeGreenhouseJob(company.name, job));
      totalJobs += normalized.length;
      totalWorking += 1;

      console.log(
        `${company.name}: ${normalized.length} jobs (sample: ${
          normalized[0]?.title ?? "none"
        })`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      totalBroken += 1;
      console.error(`${company.name}: error - ${message}`);
    }
  }

  console.log("");
  console.log("Crawl summary");
  console.log(`Total jobs found: ${totalJobs}`);
  console.log(`Total working links: ${totalWorking}`);
  console.log(`Total broken links: ${totalBroken}`);
}

main()
  .catch((error) => {
    console.error(`Crawler failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
