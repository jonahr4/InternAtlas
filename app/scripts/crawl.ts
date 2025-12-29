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
  id: string;
  name: string;
  platform: "GREENHOUSE" | "LEVER" | "WORKDAY" | "CUSTOM";
  boardUrl: string;
};

type NormalizedJob = {
  companyName: string;
  externalId: string;
  title: string;
  location: string | null;
  postedAt: string | null;
  jobUrl: string;
  descriptionText?: string | null;
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
    externalId: String(job.id),
    title: job.title,
    location: job.location?.name ?? null,
    postedAt: job.created_at ?? null,
    jobUrl: job.absolute_url,
    descriptionText: job.content ?? null,
  };
}

async function main() {
  const startedAt = Date.now();
  const keywordArg = process.argv.find((arg) => arg.startsWith("--keyword="));
  const keyword = keywordArg
    ? keywordArg.replace("--keyword=", "").trim().toLowerCase()
    : "";
  const companies = (await prisma.company.findMany({
    select: { id: true, name: true, platform: true, boardUrl: true },
  })) as Company[];
  const greenhouseCompanies = companies.filter(
    (company) => company.platform === "GREENHOUSE"
  );

  if (greenhouseCompanies.length === 0) {
    console.log("No Greenhouse companies found.");
    return;
  }

  let totalJobs = 0;
  let totalCreated = 0;
  let totalWorking = 0;
  let totalBroken = 0;
  const nameColumnWidth = Math.max(
    12,
    ...greenhouseCompanies.map((company) => company.name.length + 2)
  );

  console.log(
    `${"Company".padEnd(nameColumnWidth)}Status  \t\tTotal Jobs  \t\tNew Jobs`
  );

  for (const company of greenhouseCompanies) {
    try {
      const jobs = await fetchGreenhouseJobs(company.boardUrl);
      let normalized = jobs.map((job) =>
        normalizeGreenhouseJob(company.name, job)
      );

      if (keyword) {
        normalized = normalized.filter((job) => {
          const haystack = `${job.title} ${job.descriptionText ?? ""}`.toLowerCase();
          return haystack.includes(keyword);
        });
      }

      const existingJobs = await prisma.job.findMany({
        where: { companyId: company.id, sourcePlatform: "GREENHOUSE" },
        select: { externalId: true },
      });
      const existingIds = new Set(
        existingJobs
          .map((job) => job.externalId)
          .filter((id): id is string => Boolean(id))
      );
      const isNewCompany = existingIds.size === 0;
      let newJobsForCompany = 0;

      for (const job of normalized) {
        if (existingIds.has(job.externalId)) {
          continue;
        }

        await prisma.job.create({
          data: {
            companyId: company.id,
            title: job.title,
            location: job.location,
            postedAt: job.postedAt ? new Date(job.postedAt) : null,
            jobUrl: job.jobUrl,
            applyUrl: job.jobUrl,
            descriptionText: job.descriptionText,
            sourcePlatform: "GREENHOUSE",
            externalId: job.externalId,
            status: "ACTIVE",
          },
        });

        existingIds.add(job.externalId);
        newJobsForCompany += 1;
        totalCreated += 1;
      }

      totalJobs += normalized.length;
      totalWorking += 1;

      const status = isNewCompany ? "NEW" : "OLD";
      const totalLabel = `\t${normalized.length}\tTotal Jobs`;
      const newLabel = `\t${newJobsForCompany}\tNew Jobs`;
      console.log(
        `${company.name.padEnd(nameColumnWidth)}${status.padEnd(7)}${totalLabel.padEnd(14)}${newLabel}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      totalBroken += 1;
      console.error(`${company.name}: error - ${message}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  const avgMsPerJob = totalJobs > 0 ? Math.round(durationMs / totalJobs) : 0;

  console.log("");
  console.log("Crawl summary");
  console.log(`Total jobs found: ${totalJobs}`);
  console.log(`Total jobs created: ${totalCreated}`);
  console.log(`Total companies found: ${greenhouseCompanies.length}`);
  console.log(`Total working links: ${totalWorking}`);
  console.log(`Total broken links: ${totalBroken}`);
  console.log(`Time taken: ${(durationMs / 1000).toFixed(2)}s`);
  console.log(
    `Estimated time per job: ${avgMsPerJob}ms${totalJobs === 0 ? " (n/a)" : ""}`
  );
}

main()
  .catch((error) => {
    console.error(`Crawler failed: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
